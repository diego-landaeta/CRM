import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * El panel de Moodle del CRM (#335), con la base de verdad y Moodle simulado.
 *
 * Lo que se defiende:
 *   · cada campus sale con su estado (conectado o no) y, si lo está, sus cifras;
 *   · cursos, alumnos, estructura y recursos de un curso responden;
 *   · solo super admin y admin, y cada uno SOLO en sus campus (403 en uno ajeno);
 *   · el token y la dirección del Moodle no salen nunca.
 *
 *   npx vitest run tests/moodlePanel.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { default: modulo } = await import('../src/modules/moodle/index.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');
const credenciales = await import('../src/modules/credentials/credentials.model.js');
const moodleMod = await import('../src/modules/mcp/mcp.moodle.js');

const app = express();
app.use(express.json());
app.use(modulo.prefix, modulo.router);
app.use(errorHandler);
const request = supertest(app);

const MARCA = `MPL${Date.now().toString(36)}`;
const ORIGEN = `https://${MARCA.toLowerCase()}.moodle.test`;
const TOKEN = `tok${MARCA}0123456789abcdef`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [], credenciales: [] };
let CON; let SIN; let OTRO; let ADMIN; let ADMIN_OTRO; let GESTORA;

const como = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' })}` });
const json = (c) => new Response(JSON.stringify(c), { status: 200, headers: { 'content-type': 'application/json' } });
const AHORA = () => Math.floor(Date.now() / 1000);

const ALUMNO = [{ shortname: 'student' }];
const FUNCIONES = {
  core_course_get_courses_by_field: () => ({
    courses: [
      { id: 11, fullname: 'Máster en Psicología', displayname: 'Máster en Psicología', shortname: 'MP', categoryid: 5, categoryname: 'Másteres', startdate: AHORA() - 100 * 86400, enddate: 0, visible: 1, enablecompletion: 1, format: 'topics' },
      { id: 12, fullname: 'Curso oculto', displayname: 'Curso oculto', shortname: 'CO', categoryid: 5, categoryname: 'Másteres', startdate: 0, enddate: 0, visible: 0, enablecompletion: 0, format: 'topics' },
    ],
  }),
  core_course_get_categories: () => [{ id: 5, name: 'Másteres', parent: 0, depth: 1, coursecount: 2, visible: 1 }],
  core_enrol_get_enrolled_users: ({ courseid }) => (courseid === 11 ? [{ id: 1, roles: ALUMNO, lastcourseaccess: AHORA() - 86400, lastaccess: AHORA() - 86400 }, { id: 2, roles: ALUMNO, lastcourseaccess: 0, lastaccess: 0 }] : []),
  core_course_get_contents: () => [{ id: 1, section: 0, name: '', visible: 1, modules: [{ id: 5, name: 'Bienvenida', modname: 'forum', visible: 1 }] }],
  mod_url_get_urls_by_courses: () => ({ urls: [] }),
  core_completion_get_course_completion_status: () => ({ exception: 'moodle_exception', errorcode: 'nocriteriaset', message: 'No hay criterios' }),
};

function parametros(p) {
  const opciones = {};
  for (const [k, v] of p.entries()) {
    const o = k.match(/^options\[(\d+)\]\[name\]$/);
    if (o) opciones[v] = p.get(`options[${o[1]}][value]`);
  }
  return { courseid: p.get('courseid') ? Number(p.get('courseid')) : null, opciones };
}

beforeAll(async () => {
  const proy = async (c) => {
    const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} ${c}`, `${MARCA.toLowerCase()}-${c}`, `${MARCA}-key-${c}`]);
    ids.projects.push(p.id);
    return p.id;
  };
  CON = await proy('con'); SIN = await proy('sin'); OTRO = await proy('otro');
  const persona = async (n, role, campus) => {
    const [u] = await q(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role`,
      [`${MARCA} ${n}`, `${n.toLowerCase()}@${MARCA.toLowerCase()}.test`, role]);
    ids.users.push(u.id);
    for (const c of campus) await q(`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`, [u.id, c]);
    return u;
  };
  ADMIN = await persona('ADMIN', 'admin', [CON, SIN]);
  ADMIN_OTRO = await persona('ADMINOTRO', 'admin', [OTRO]);
  GESTORA = await persona('GESTORA', 'gestor', [CON]);
  const cred = await credenciales.upsert({ project_id: CON, service: 'moodle', entorno: 'produccion', value: JSON.stringify({ url: ORIGEN, token: TOKEN }) });
  ids.credenciales.push(cred.id);
}, 60000);

afterAll(async () => {
  await q(`DELETE FROM api_credentials WHERE id = ANY($1::int[])`, [ids.credenciales]);
  await q(`DELETE FROM user_projects WHERE user_id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids.projects]);
  await pool.end();
}, 60000);

beforeEach(() => {
  moodleMod.vaciarCacheMoodle();
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    if (String(url) !== `${ORIGEN}/webservice/rest/server.php`) return original(url, init);
    const p = new URLSearchParams(init.body);
    if (p.get('wstoken') !== TOKEN) return json({ exception: 'moodle_exception', errorcode: 'invalidtoken', message: 'x' });
    const f = FUNCIONES[p.get('wsfunction')];
    return f ? json(f(parametros(p))) : json({ exception: 'webservice_access_exception', errorcode: 'accessexception', message: 'x' });
  }));
});

describe('el panel de Moodle', () => {
  it('cada campus con su estado: el conectado trae sus cifras y el otro, nada inventado', async () => {
    const r = await request.get('/api/moodle/campus').set(como(ADMIN));
    expect(r.status).toBe(200);
    const [primero, segundo] = r.body.data.campus;
    expect(primero).toMatchObject({ id: CON, configurado: true, cursos: { total: 2, activos: 1, ocultos: 1 } });
    expect(segundo).toMatchObject({ id: SIN, configurado: false });
    expect(segundo.cursos).toBeUndefined();
  });

  it('con proyecto_id solo ese campus, y uno ajeno es un 403', async () => {
    const uno = await request.get(`/api/moodle/campus?proyecto_id=${CON}`).set(como(ADMIN));
    expect(uno.body.data.campus).toHaveLength(1);
    expect(uno.body.data.campus[0]).toMatchObject({ id: CON, configurado: true, cursos: { activos: 1 } });
    expect((await request.get(`/api/moodle/campus?proyecto_id=${CON}`).set(como(ADMIN_OTRO))).status).toBe(403);
  });

  it('los cursos de un campus, con su número de alumnos', async () => {
    const r = await request.get(`/api/moodle/cursos?proyecto_id=${CON}&estado=todos`).set(como(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
    expect(r.body.data.cursos.find((c) => c.curso_id === 11)).toMatchObject({ nombre: 'Máster en Psicología', alumnos: 2, visible: true, estado: 'activo' });
  });

  it('las categorías, para filtrar', async () => {
    const r = await request.get(`/api/moodle/categorias?proyecto_id=${CON}`).set(como(ADMIN));
    expect(r.body.data.categorias).toEqual([expect.objectContaining({ id: 5, nombre: 'Másteres', cursos: 2 })]);
  });

  it('un curso: alumnos (con el motivo de que no haya «terminados»), estructura y recursos', async () => {
    const a = await request.get(`/api/moodle/cursos/11/alumnos?proyecto_id=${CON}`).set(como(ADMIN));
    expect(a.body.data).toMatchObject({ matriculados: 2, nunca_han_entrado: 1, terminados: null, criterios_de_finalizacion: false });
    const e = await request.get(`/api/moodle/cursos/11/estructura?proyecto_id=${CON}`).set(como(ADMIN));
    expect(e.body.data).toMatchObject({ total_secciones: 1, total_actividades: 1 });
    const r = await request.get(`/api/moodle/cursos/11/recursos?proyecto_id=${CON}`).set(como(ADMIN));
    expect(r.body.data.total_recursos_externos).toBe(0);
  });

  it('un campus sin Moodle da un error claro, no un cero', async () => {
    const r = await request.get(`/api/moodle/cursos?proyecto_id=${SIN}`).set(como(ADMIN));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.body)).toMatch(/sin Moodle configurado|no se pudo consultar/i);
  });
});

describe('quién puede', () => {
  it('un admin de otro campus: 403 en el Moodle ajeno', async () => {
    for (const ruta of ['/api/moodle/cursos', '/api/moodle/categorias', '/api/moodle/cursos/11/alumnos', '/api/moodle/cursos/11/estructura', '/api/moodle/cursos/11/recursos']) {
      const r = await request.get(`${ruta}?proyecto_id=${CON}`).set(como(ADMIN_OTRO));
      expect(r.status, ruta).toBe(403);
    }
  });

  it('una gestora no entra al panel, ni a su propio campus', async () => {
    expect((await request.get('/api/moodle/campus').set(como(GESTORA))).status).toBe(403);
    expect((await request.get(`/api/moodle/cursos?proyecto_id=${CON}`).set(como(GESTORA))).status).toBe(403);
  });

  it('sin sesión, 401', async () => {
    expect((await request.get('/api/moodle/campus')).status).toBe(401);
  });

  it('ni el token ni la dirección del Moodle salen en ninguna respuesta', async () => {
    const todo = [];
    for (const ruta of ['/api/moodle/campus', `/api/moodle/cursos?proyecto_id=${CON}&estado=todos`, `/api/moodle/categorias?proyecto_id=${CON}`, `/api/moodle/cursos/11/alumnos?proyecto_id=${CON}`, `/api/moodle/cursos/11/estructura?proyecto_id=${CON}`, `/api/moodle/cursos/11/recursos?proyecto_id=${CON}`]) {
      todo.push(JSON.stringify((await request.get(ruta).set(como(ADMIN))).body));
    }
    const texto = todo.join('\n');
    expect(texto).not.toContain(TOKEN);
    expect(texto).not.toContain(ORIGEN);
  });
});
