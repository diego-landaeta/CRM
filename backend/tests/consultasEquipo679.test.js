import {
  describe, it, expect, beforeAll, afterAll, afterEach, vi,
} from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { query } from '../src/shared/config/db.js';
import { encrypt } from '../src/shared/utils/crypto.js';
import { errorHandler } from '../src/shared/middleware/errorHandler.js';
import * as servicio from '../src/modules/consultas/consultas.service.js';
import { sincronizarCampus } from '../src/modules/consultas/consultas.plugin.js';
import { procesarAviso } from '../src/modules/consultas/consultas.avisos.js';
import { repasarTodos } from '../src/jobs/moodleSincronizacionScheduler.js';
import consultasModule from '../src/modules/consultas/index.js';

/**
 * Chat directo Moodle ↔ CRM (#679), lo que reparte y organiza al equipo, contra la base de
 * verdad y con un Moodle de mentira que contesta como uno de verdad:
 *
 *   · reparto por curso: una consulta va a una tutora DE ESE CURSO, nunca a una de otro,
 *     aunque esa otra esté más libre;
 *   · relevo: si la tutora no está («No disponible»), la cubre otra del mismo curso; si no
 *     hay ninguna, la consulta queda sin tutora (no se manda fuera del curso);
 *   · una conversación nueva del mismo alumno y curso entra en la consulta abierta;
 *   · notas internas: solo el equipo, nunca salen al campus;
 *   · respuestas guardadas: las personales son de cada una; las del campus, de coordinación;
 *   · el repaso de cada 15 minutos recupera lo que no llegó y no duplica lo que sí.
 *
 *   npx vitest run tests/consultasEquipo679.test.js
 */

const marca = `t679e${Date.now()}`;
const ids = { users: [], projects: [] };
let hayBase = true;
let porQueNo = null;
let alumnoN = 70000;
let conversacionN = 80000;
let mensajeN = 9000000;

// ─── El Moodle de mentira ────────────────────────────────────────────────────

/** Lo que cada campus de mentira sabe, por su dirección. */
const campusFalsos = new Map();
const envios = [];

function campusFalso(url) {
  const c = {
    // curso → [{ id, rol }]
    cursos: new Map(),
    // Páginas que devuelve local_crm_mensajes_desde, en orden.
    paginas: [],
    pedidosDesde: [],
    disponibilidad: [],
    caido: false,
    pluginViejo: false,
    // Antes de contestar la lista de un curso (para cambiarla entre una pregunta y otra).
    alPedirCurso: null,
  };
  campusFalsos.set(url, c);
  return c;
}

const json = (d) => ({ ok: true, status: 200, json: async () => d });

vi.stubGlobal('fetch', vi.fn(async (url, { body } = {}) => {
  const base = String(url).replace(/\/webservice\/rest\/server\.php$/, '');
  const c = campusFalsos.get(base);
  if (!c) return json([]);
  if (c.caido) throw new TypeError('fetch failed');
  const p = new URLSearchParams(body);
  const f = p.get('wsfunction');
  if (f === 'core_enrol_get_enrolled_users') {
    const curso = Number(p.get('courseid'));
    if (c.alPedirCurso) c.alPedirCurso(curso);
    return json((c.cursos.get(curso) || []).map((g) => ({
      id: g.id, fullname: `Persona ${g.id}`, roles: [{ shortname: g.rol }], groups: [],
    })));
  }
  if (f === 'core_enrol_get_users_courses') {
    const uid = Number(p.get('userid'));
    return json([...c.cursos.entries()].filter(([, gente]) => gente.some((g) => g.id === uid)).map(([id]) => ({ id, fullname: `Curso ${id}` })));
  }
  if (f === 'local_crm_mensajes_desde') {
    if (c.pluginViejo) return json({ exception: 'webservice_access_exception', errorcode: 'accessexception', message: 'x' });
    c.pedidosDesde.push(p.get('desdeid') ? { desdeid: Number(p.get('desdeid')) } : { desdefecha: Number(p.get('desdefecha')) });
    return json(c.paginas.shift() || { avisos: '[]', hastaid: 0, mas: false, version: '1.8.0' });
  }
  if (f === 'local_crm_disponibilidad') {
    const lista = [];
    for (const [k, v] of p.entries()) if (k.startsWith('nodisponibles[')) lista.push(Number(v));
    c.disponibilidad.push(lista.sort((a, b) => a - b));
    return json({ ok: true });
  }
  if (f === 'core_message_send_instant_messages') {
    envios.push({ base, para: Number(p.get('messages[0][touserid]')), texto: p.get('messages[0][text]') });
    return json([{ msgid: 1, conversationid: 1 }]);
  }
  return json([]);
}));

// ─── Datos ───────────────────────────────────────────────────────────────────

async function crearUsuario(role) {
  const { rows } = await query(
    `INSERT INTO users (nombre, email, password_hash, role, active) VALUES ($1, $2, 'x', $3, true) RETURNING id`,
    [`${role} ${ids.users.length} ${marca}`, `${role}.${ids.users.length}.${marca}@test.local`, role]);
  ids.users.push(rows[0].id);
  return Number(rows[0].id);
}

/** Un campus conectado a su Moodle de mentira, con «Leer las consultas» encendido. */
async function crearCampus(nombre, { plugin = false, consultas = true } = {}) {
  const n = ids.projects.length;
  const { rows } = await query(
    `INSERT INTO projects (nombre, slug, webhook_api_key, active) VALUES ($1, $2, $3, true) RETURNING id`,
    [`${nombre} ${marca}`, `${nombre.toLowerCase()}-${marca}-${n}`, `k-${marca}-${n}`]);
  const p = Number(rows[0].id);
  ids.projects.push(p);
  const url = `https://${marca}-${n}.campus.test`;
  const enc = encrypt('token-del-campus');
  await query(
    `INSERT INTO project_integrations (project_id, provider, active, encrypted_value, iv, auth_tag, config_public)
     VALUES ($1, 'moodle', true, $2, $3, $4, $5)`,
    [p, enc.encrypted, enc.iv, enc.authTag, JSON.stringify({ url, consultas, consultas_desde: '2026-01-01T00:00:00Z' })]);
  if (plugin) {
    const s = encrypt('secreto-del-plugin');
    await query(
      `INSERT INTO moodle_plugin_campus (project_id, secreto_cifrado, secreto_iv, secreto_tag, activo) VALUES ($1, $2, $3, $4, true)`,
      [p, s.encrypted, s.iv, s.authTag]);
  }
  return { id: p, moodle: campusFalso(url) };
}

/** Una tutora del campus, con su cuenta de Moodle vinculada. */
async function tutora(projectId, moodleId, { disponible = true } = {}) {
  const t = await crearUsuario('tutor');
  await query('INSERT INTO user_projects (user_id, project_id, active) VALUES ($1, $2, true)', [t, projectId]);
  await query(`INSERT INTO tutor_campus (tutor_id, project_id, estado, moodle_user_id) VALUES ($1, $2, 'activa', $3)`,
    [t, projectId, moodleId]);
  if (!disponible) await noDisponible(t);
  return t;
}

const noDisponible = (t) => query('UPDATE users SET consultas_disponible = false WHERE id = $1', [t]);

/** Lo que manda el alumno desde «Entrar al chat» de un curso. */
const delAlumno = (projectId, cursoId, extra = {}) => {
  alumnoN += 1;
  conversacionN += 1;
  return {
    projectId, conversacionId: conversacionN, alumno: { moodleId: alumnoN, nombre: `Alumno ${alumnoN}` },
    curso: cursoId ? { moodleId: cursoId, nombre: null } : null,
    texto: 'No me abre la tarea 2', externoId: (mensajeN += 1), escritoAt: new Date(), ...extra,
  };
};

beforeAll(async () => {
  try {
    const t = await query(`SELECT to_regclass('public.consultas') AS a, to_regclass('public.moodle_plugin_campus') AS b,
                                  to_regclass('public.consulta_notas') AS c, to_regclass('public.respuestas_guardadas') AS d`);
    if (!t.rows[0].a || !t.rows[0].b || !t.rows[0].c || !t.rows[0].d) throw new Error('Faltan las migraciones 244 y 245.');
  } catch (err) {
    hayBase = false;
    porQueNo = err.message;
  }
});

afterEach(() => { envios.length = 0; });

afterAll(async () => {
  for (const [sql, p] of [
    ['DELETE FROM respuestas_guardadas WHERE creado_por = ANY($1::int[]) OR project_id = ANY($2::int[])', [ids.users, ids.projects]],
    ['DELETE FROM consultas WHERE project_id = ANY($1::int[])', [ids.projects]],
    ['DELETE FROM moodle_plugin_campus WHERE project_id = ANY($1::int[])', [ids.projects]],
    ['DELETE FROM tutor_campus WHERE tutor_id = ANY($1::int[])', [ids.users]],
    ['DELETE FROM user_projects WHERE user_id = ANY($1::int[])', [ids.users]],
    ['DELETE FROM project_integrations WHERE project_id = ANY($1::int[])', [ids.projects]],
    ['DELETE FROM activity_log WHERE user_id = ANY($1::int[])', [ids.users]],
    ['DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]],
    ['DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]],
  ]) {
    try { await query(sql, p); } catch { /* sigue limpiando */ }
  }
  vi.unstubAllGlobals();
});

describe('hay base', () => {
  it('contra la que probar', () => { expect(hayBase, porQueNo || '').toBe(true); });
});

// ─── Reparto por curso y relevo ──────────────────────────────────────────────

describe('#679 · cada consulta, a una tutora de ese curso', () => {
  /*
    Curso 7: Laura y Carmen. Curso 8: Sofía. Sofía está libre y Carmen cargada: sin el
    filtro por curso, el reparto mandaría las consultas del curso 7 a Sofía.
  */
  async function escenario() {
    const campus = await crearCampus('Curso');
    const laura = await tutora(campus.id, 101);
    const carmen = await tutora(campus.id, 102);
    const sofia = await tutora(campus.id, 103);
    campus.moodle.cursos.set(7, [{ id: 101, rol: 'editingteacher' }, { id: 102, rol: 'teacher' }, { id: 900, rol: 'student' }]);
    campus.moodle.cursos.set(8, [{ id: 103, rol: 'editingteacher' }]);
    // Carmen ya lleva dos abiertas; Sofía, ninguna.
    for (let i = 0; i < 2; i += 1) {
      await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 7), { tutorPreferido: carmen, avisar: false });
    }
    return { campus, laura, carmen, sofia };
  }

  it('va a la tutora a la que escribió el alumno, si es de ese curso', async () => {
    if (!hayBase) return;
    const { campus, laura } = await escenario();
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 7), { tutorPreferido: laura, avisar: false });
    expect(r.consulta.tutor_id).toBe(laura);
  });

  it('relevo: con Laura «No disponible» la cubre Carmen (del curso), nunca Sofía (de otro, y más libre)', async () => {
    if (!hayBase) return;
    const { campus, laura, carmen } = await escenario();
    await noDisponible(laura);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 7), { tutorPreferido: laura, avisar: false });
    expect(r.consulta.tutor_id).toBe(carmen);
  });

  it('sin nadie del curso que pueda, queda sin tutora en vez de ir a otro curso', async () => {
    if (!hayBase) return;
    const { campus, laura, carmen } = await escenario();
    await noDisponible(laura);
    await noDisponible(carmen);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 7), { tutorPreferido: laura, avisar: false });
    expect(r.consulta.tutor_id).toBeNull();
  });

  it('si su tutora se va («No disponible») a mitad, el siguiente mensaje del alumno pasa la consulta a otra del curso', async () => {
    if (!hayBase) return;
    const { campus, laura, carmen } = await escenario();
    const m = delAlumno(campus.id, 7);
    const r1 = await servicio.entraMensajeDelAlumno(m, { tutorPreferido: laura, avisar: false });
    expect(r1.consulta.tutor_id).toBe(laura);
    await noDisponible(laura);
    const r2 = await servicio.entraMensajeDelAlumno({ ...m, externoId: (mensajeN += 1), texto: '¿Alguien?' }, { tutorPreferido: laura, avisar: false });
    expect(r2.nueva).toBe(false);
    expect(r2.consulta.id).toBe(r1.consulta.id);
    expect(r2.consulta.tutor_id).toBe(carmen);
    const { rows } = await query(`SELECT tipo, detalle FROM consulta_eventos WHERE consulta_id = $1 AND tipo = 'reasignada'`, [r1.consulta.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].detalle).toMatchObject({ de: laura, a: carmen, automatica: true });
  });

  it('alguien que entró en el curso hace un momento cuenta: se pregunta otra vez a Moodle antes de dejarla sin tutora', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Fresco');
    const laura = await tutora(campus.id, 201, { disponible: false });
    const carmen = await tutora(campus.id, 202);
    // La primera vez que se pregunta por el curso 9, solo está Laura; después, también Carmen.
    let preguntas = 0;
    campus.moodle.cursos.set(9, [{ id: 201, rol: 'editingteacher' }]);
    campus.moodle.alPedirCurso = (curso) => {
      if (curso !== 9) return;
      preguntas += 1;
      if (preguntas === 2) campus.moodle.cursos.set(9, [{ id: 201, rol: 'editingteacher' }, { id: 202, rol: 'teacher' }]);
    };
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 9), { tutorPreferido: laura, avisar: false });
    expect(preguntas).toBe(2);
    expect(r.consulta.tutor_id).toBe(carmen);
  });

  it('un alumno sin cursos (mensajería general) va a la tutora a la que escribió, no se queda sin nadie', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('SinCursos');
    await tutora(campus.id, 351);
    const laura = await tutora(campus.id, 352);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, null), { tutorPreferido: laura, avisar: false });
    expect(r.consulta.tutor_id).toBe(laura);
  });

  it('con el Moodle caído no se deja la consulta sin nadie: se reparte entre las del campus', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Caido');
    const ana = await tutora(campus.id, 301);
    campus.moodle.caido = true;
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, 11), { avisar: false });
    expect(r.consulta.tutor_id).toBe(ana);
  });
});

describe('#679 · una sola consulta por alumno y curso', () => {
  it('si el alumno abre otra conversación del mismo curso (con la tutora que le cubre), entra en la consulta abierta', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Hilo');
    const laura = await tutora(campus.id, 401);
    const carmen = await tutora(campus.id, 402);
    campus.moodle.cursos.set(21, [{ id: 401, rol: 'editingteacher' }, { id: 402, rol: 'teacher' }]);
    const m = delAlumno(campus.id, 21);
    const r1 = await servicio.entraMensajeDelAlumno(m, { tutorPreferido: laura, avisar: false });
    // Laura deja de estar; el alumno vuelve a «Entrar al chat» y Moodle le abre la conversación con Carmen.
    await noDisponible(laura);
    const r2 = await servicio.entraMensajeDelAlumno(
      { ...m, conversacionId: (conversacionN += 1), externoId: (mensajeN += 1), texto: 'Sigo sin poder' },
      { tutorPreferido: carmen, avisar: false });
    expect(r2.nueva).toBe(false);
    expect(r2.consulta.id).toBe(r1.consulta.id);
    expect(r2.consulta.tutor_id).toBe(carmen);
    const { rows: [c] } = await query('SELECT conversaciones_extra FROM consultas WHERE id = $1', [r1.consulta.id]);
    expect((c.conversaciones_extra || []).map(Number)).toContain(conversacionN);
    const { rows: [n] } = await query(`SELECT COUNT(*)::int AS n FROM consulta_mensajes WHERE consulta_id = $1 AND autor = 'alumno'`, [r1.consulta.id]);
    expect(n.n).toBe(2);
  });

  it('otro curso es otra consulta, y una consulta cerrada no recoge conversaciones nuevas', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Separadas');
    const laura = await tutora(campus.id, 501);
    campus.moodle.cursos.set(31, [{ id: 501, rol: 'editingteacher' }]);
    campus.moodle.cursos.set(32, [{ id: 501, rol: 'editingteacher' }]);
    const m = delAlumno(campus.id, 31);
    const r1 = await servicio.entraMensajeDelAlumno(m, { tutorPreferido: laura, avisar: false });
    const otroCurso = await servicio.entraMensajeDelAlumno(
      { ...m, curso: { moodleId: 32, nombre: null }, conversacionId: (conversacionN += 1), externoId: (mensajeN += 1) },
      { tutorPreferido: laura, avisar: false });
    expect(otroCurso.nueva).toBe(true);
    expect(otroCurso.consulta.id).not.toBe(r1.consulta.id);
    await query(`UPDATE consultas SET estado = 'cerrada', cerrada_at = NOW() WHERE id = $1`, [r1.consulta.id]);
    const trasCerrar = await servicio.entraMensajeDelAlumno(
      { ...m, conversacionId: (conversacionN += 1), externoId: (mensajeN += 1) }, { tutorPreferido: laura, avisar: false });
    expect(trasCerrar.nueva).toBe(true);
  });
});

// ─── Notas internas y respuestas guardadas (API) ─────────────────────────────

const app = express();
app.use(express.json());
app.use(consultasModule.prefix, consultasModule.router);
app.use(errorHandler);
const como = (user) => {
  const token = jwt.sign(user, process.env.JWT_SECRET);
  const con = (r) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (u) => con(supertest(app).get(u)),
    post: (u, b) => con(supertest(app).post(u).send(b)),
    put: (u, b) => con(supertest(app).put(u).send(b)),
    del: (u) => con(supertest(app).delete(u)),
  };
};

describe('#679 · notas internas', () => {
  it('la tutora de la consulta anota; la nota sale en la ficha, con su autora, y NO va al campus', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Notas');
    const laura = await tutora(campus.id, 601);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, null), { tutorPreferido: laura, avisar: false });
    const yo = como({ userId: laura, role: 'tutor' });
    const res = await yo.post(`/api/consultas/${r.consulta.id}/notas`, { texto: '  Le pasé el enlace del tema 2; si vuelve, revisar la entrega.  ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ texto: 'Le pasé el enlace del tema 2; si vuelve, revisar la entrega.', autor_user_id: laura });
    expect(envios).toHaveLength(0);
    const ficha = await yo.get(`/api/consultas/${r.consulta.id}`);
    expect(ficha.status).toBe(200);
    expect(JSON.stringify(ficha.body.data)).toContain('Le pasé el enlace del tema 2');
  });

  it('vacía o de más de 4000 caracteres, no se guarda', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('NotasMal');
    const laura = await tutora(campus.id, 611);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, null), { tutorPreferido: laura, avisar: false });
    const yo = como({ userId: laura, role: 'tutor' });
    expect((await yo.post(`/api/consultas/${r.consulta.id}/notas`, { texto: '   ' })).status).toBe(400);
    expect((await yo.post(`/api/consultas/${r.consulta.id}/notas`, { texto: 'x'.repeat(4001) })).status).toBe(400);
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM consulta_notas WHERE consulta_id = $1', [r.consulta.id]);
    expect(rows[0].n).toBe(0);
  });

  it('una tutora que no lleva la consulta no puede anotar (ni saber que existe)', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('NotasAjena');
    const laura = await tutora(campus.id, 621);
    const otra = await tutora(campus.id, 622);
    const r = await servicio.entraMensajeDelAlumno(delAlumno(campus.id, null), { tutorPreferido: laura, avisar: false });
    const res = await como({ userId: otra, role: 'tutor' }).post(`/api/consultas/${r.consulta.id}/notas`, { texto: 'hola' });
    expect(res.status).toBe(404);
  });
});

describe('#679 · respuestas guardadas', () => {
  it('las personales son de cada tutora: otra no las ve, ni las cambia, ni las borra', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Resp');
    const laura = await tutora(campus.id, 701);
    const carmen = await tutora(campus.id, 702);
    const yo = como({ userId: laura, role: 'tutor' });
    const ella = como({ userId: carmen, role: 'tutor' });
    const creada = await yo.post('/api/consultas/respuestas', { titulo: 'Plazo de entrega', texto: 'El plazo es el domingo a las 23:59.' });
    expect(creada.status).toBe(200);
    const mia = creada.body.data.find((x) => x.titulo === 'Plazo de entrega');
    expect(mia).toMatchObject({ personal: true });
    expect((await ella.get('/api/consultas/respuestas')).body.data.some((x) => x.id === mia.id)).toBe(false);
    expect((await ella.put(`/api/consultas/respuestas/${mia.id}`, { titulo: 'X', texto: 'Y' })).status).toBe(404);
    expect((await ella.del(`/api/consultas/respuestas/${mia.id}`)).status).toBe(404);
    const cambiada = await yo.put(`/api/consultas/respuestas/${mia.id}`, { titulo: 'Plazo', texto: 'Domingo, 23:59.' });
    expect(cambiada.body.data.find((x) => x.id === mia.id)).toMatchObject({ titulo: 'Plazo', texto: 'Domingo, 23:59.' });
    expect((await yo.del(`/api/consultas/respuestas/${mia.id}`)).status).toBe(200);
  });

  it('las del campus: una tutora no puede crearlas; coordinación sí, y las ven las tutoras de ese campus (no las de otro)', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('RespCampus');
    const otroCampus = await crearCampus('RespOtro');
    const laura = await tutora(campus.id, 711);
    const deOtro = await tutora(otroCampus.id, 712);
    const coordina = await crearUsuario('superadmin');
    const res = await como({ userId: laura, role: 'tutor' }).post('/api/consultas/respuestas', { titulo: 'Bienvenida', texto: 'Hola', projectId: campus.id });
    expect(res.status).toBe(403);
    const ok = await como({ userId: coordina, role: 'superadmin' }).post('/api/consultas/respuestas', { titulo: 'Bienvenida del campus', texto: 'Bienvenida al curso.', projectId: campus.id });
    expect(ok.status).toBe(200);
    const laVe = (await como({ userId: laura, role: 'tutor' }).get('/api/consultas/respuestas')).body.data;
    expect(laVe.find((x) => x.titulo === 'Bienvenida del campus')).toMatchObject({ personal: false, project_id: campus.id });
    const noLaVe = (await como({ userId: deOtro, role: 'tutor' }).get('/api/consultas/respuestas')).body.data;
    expect(noLaVe.some((x) => x.titulo === 'Bienvenida del campus')).toBe(false);
    // Y la tutora tampoco la puede tocar.
    const r = laVe.find((x) => x.titulo === 'Bienvenida del campus');
    expect((await como({ userId: laura, role: 'tutor' }).del(`/api/consultas/respuestas/${r.id}`)).status).toBe(403);
  });

  it('las que tenía en el navegador pasan a su cuenta sin duplicar por título (y las vacías se saltan)', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Importar');
    const laura = await tutora(campus.id, 721);
    const yo = como({ userId: laura, role: 'tutor' });
    await yo.post('/api/consultas/respuestas', { titulo: 'Saludo', texto: 'Hola, ¿en qué te ayudo?' });
    const r = await yo.post('/api/consultas/respuestas/importar', { respuestas: [
      { titulo: 'saludo', texto: 'repetida por título' },
      { titulo: 'Despedida', texto: 'Un saludo.' },
      { titulo: '', texto: 'sin título' },
    ] });
    expect(r.status).toBe(200);
    expect(r.body.data.importadas).toBe(1);
    expect(r.body.data.respuestas.filter((x) => x.personal).map((x) => x.titulo).sort()).toEqual(['Despedida', 'Saludo']);
  });
});

// ─── El repaso de cada 15 minutos ────────────────────────────────────────────

/** Un aviso como los del plugin: el alumno escribe a su tutora. */
const avisoDelAlumno = (alumno, tutoraMoodle, { id = (mensajeN += 1), conversacion = 600001, curso = null, texto = 'Hola' } = {}) => ({
  evento: 'mensaje',
  mensaje: { id, conversacion_id: conversacion, html: `<p>${texto}</p>`, fecha: Math.floor(Date.now() / 1000), curso_id: curso },
  de: { id: alumno, nombre: `Alumno ${alumno}`, personal: false },
  para: [{ id: tutoraMoodle, personal: true }],
});
const pagina = (avisos, hastaid, mas = false) => ({ avisos: JSON.stringify(avisos), hastaid, mas, version: '1.8.0' });

describe('#679 · el repaso recupera lo que no llegó, sin duplicar', () => {
  it('lee página a página, guarda hasta dónde llegó y manda la lista de «No disponible»', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Repaso', { plugin: true });
    await tutora(campus.id, 801);
    await tutora(campus.id, 802, { disponible: false });
    // Este llegó por el aviso al momento; el repaso lo vuelve a traer y no debe duplicarlo.
    const yaLlego = avisoDelAlumno(8001, 801, { conversacion: 600101 });
    expect((await procesarAviso(campus.id, yaLlego)).resultado).toBe('consulta_nueva');
    campus.moodle.paginas.push(
      pagina([yaLlego, avisoDelAlumno(8002, 801, { conversacion: 600102 })], 500, true),
      pagina([avisoDelAlumno(8003, 801, { conversacion: 600103 })], 520, false));

    const r = await sincronizarCampus(campus.id, { procesar: procesarAviso, desdeFecha: '2026-01-01T00:00:00Z' });
    expect(r).toMatchObject({ mensajes: 3, nuevos: 2, paginas: 2, version: '1.8.0' });
    expect(r.error).toBeUndefined();
    // La primera página, desde la fecha; la segunda, desde el último id visto.
    expect(campus.moodle.pedidosDesde[0]).toHaveProperty('desdefecha');
    expect(campus.moodle.pedidosDesde[1]).toEqual({ desdeid: 500 });
    expect(campus.moodle.disponibilidad).toEqual([[802]]);

    const { rows: [estado] } = await query(
      'SELECT sincronizado_hasta_id, sincronizado_at, sincronizacion_error, version_plugin FROM moodle_plugin_campus WHERE project_id = $1', [campus.id]);
    expect(Number(estado.sincronizado_hasta_id)).toBe(520);
    expect(estado.sincronizado_at).not.toBeNull();
    expect(estado.sincronizacion_error).toBeNull();
    expect(estado.version_plugin).toBe('1.8.0');

    const { rows: [n] } = await query(
      `SELECT COUNT(DISTINCT c.id)::int AS consultas, COUNT(m.id)::int AS mensajes
         FROM consultas c JOIN consulta_mensajes m ON m.consulta_id = c.id WHERE c.project_id = $1`, [campus.id]);
    expect(n).toEqual({ consultas: 3, mensajes: 3 });

    // El siguiente repaso sigue desde 520 y, sin nada nuevo, no toca nada.
    const otra = await sincronizarCampus(campus.id, { procesar: procesarAviso });
    expect(otra).toMatchObject({ mensajes: 0, nuevos: 0 });
    expect(campus.moodle.pedidosDesde[2]).toEqual({ desdeid: 520 });
  });

  it('con el plugin anterior a la 1.8.0 dice qué hacer y no pierde por dónde iba', async () => {
    if (!hayBase) return;
    const campus = await crearCampus('Viejo', { plugin: true });
    await query('UPDATE moodle_plugin_campus SET sincronizado_hasta_id = 77 WHERE project_id = $1', [campus.id]);
    campus.moodle.pluginViejo = true;
    const r = await sincronizarCampus(campus.id, { procesar: procesarAviso });
    expect(r.error).toMatch(/1\.8\.0/);
    const { rows: [estado] } = await query(
      'SELECT sincronizado_hasta_id, sincronizacion_error FROM moodle_plugin_campus WHERE project_id = $1', [campus.id]);
    expect(Number(estado.sincronizado_hasta_id)).toBe(77);
    expect(estado.sincronizacion_error).toMatch(/1\.8\.0/);
  });

  it('un campus sin el plugin no se repasa, ni uno con «Leer las consultas» apagado', async () => {
    if (!hayBase) return;
    const sinPlugin = await crearCampus('SinPlugin');
    expect(await sincronizarCampus(sinPlugin.id, { procesar: procesarAviso })).toMatchObject({ omitido: 'sin plugin activo' });
    const apagado = await crearCampus('Apagado', { plugin: true, consultas: false });
    apagado.moodle.paginas.push(pagina([avisoDelAlumno(8101, 901)], 10));
    const todos = await repasarTodos();
    expect(todos.some((x) => x.projectId === apagado.id)).toBe(false);
    expect(apagado.moodle.pedidosDesde).toHaveLength(0);
  });
});
