import {
  describe, it, expect, beforeAll, afterAll, afterEach, vi,
} from 'vitest';
import crypto from 'crypto';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Zadarma en el CRM (#137), fase 1, contra la base local y con la API de
 * Zadarma SIMULADA (no sale nada a internet: `fetch` es de mentira).
 *
 * Lo que se defiende:
 *   · la firma de las peticiones es la de Zadarma: base64 del HMAC-SHA1 en
 *     HEXADECIMAL de metodo + params + md5(params), con `format=json` dentro;
 *   · un aviso con firma mala se rechaza (401) y no guarda nada;
 *   · el mismo aviso dos veces cuenta UNA llamada y UN contacto (idempotencia);
 *   · una gestora no llama a un prospecto de otra (403) y Zadarma ni se entera;
 *   · un campus sin credenciales no llama (409) y no sale en /estado;
 *   · el reporte por gestora: llamadas, contestadas y duración; una gestora
 *     solo se ve a sí misma.
 *
 *   docker compose -f docker-compose.dev.yml up -d && npm run db:preparar
 *   npx vitest run tests/zadarma137.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { default: zadarma } = await import('../src/modules/zadarma/index.js');
const { default: integraciones } = await import('../src/modules/integrations/index.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');
const { encrypt } = await import('../src/shared/utils/crypto.js');
const { codificarFirma, firmarPeticion } = await import('../src/modules/zadarma/zadarma.client.js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));  // Zadarma avisa como formulario
app.use(zadarma.prefix, zadarma.router);
app.use(integraciones.prefix, integraciones.router);
app.use(errorHandler);
const request = supertest(app);

const MARCA = `ZD${Date.now().toString(36)}`;
const CLAVE = 'clave-de-mentira-123';
const SECRETO = 'secreto-de-mentira-456';
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [], leads: [] };
let A; let B; let ANA; let DAYANA; let ADMIN; let L_ANA; let L_DAYANA; let L_B;
const jwtDe = (u) => jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' });
const como = (u) => ({ Authorization: `Bearer ${jwtDe(u)}` });

async function campus(nombre) {
  const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
    [`${MARCA} ${nombre}`, `${MARCA.toLowerCase()}-${nombre.toLowerCase()}`, `${MARCA}-${nombre}-key`]);
  ids.projects.push(p.id);
  return p.id;
}

async function persona(nombre, role, campusIds, extension = null) {
  const [u] = await q(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role`,
    [`${MARCA} ${nombre}`, `${nombre.toLowerCase()}@${MARCA.toLowerCase()}.test`, role]);
  ids.users.push(u.id);
  for (const pid of campusIds) {
    await q('INSERT INTO user_projects (user_id, project_id, zadarma_extension) VALUES ($1, $2, $3)',
      [u.id, pid, pid === campusIds[0] ? extension : null]);
  }
  return u;
}

async function lead(nombre, pid, responsable, telefono) {
  const [l] = await q(`INSERT INTO leads (project_id, nombre, responsable_id, telefono) VALUES ($1, $2, $3, $4) RETURNING id`,
    [pid, `${MARCA} ${nombre}`, responsable, telefono]);
  ids.leads.push(l.id);
  return l.id;
}

/** Zadarma de mentira: contesta como su API y apunta lo que se le pidió. */
function zadarmaSimulado() {
  const llamadas = [];
  const fetchFalso = vi.fn(async (url, opciones) => {
    llamadas.push({ url: String(url), headers: opciones?.headers || {} });
    const u = new URL(String(url));
    if (u.pathname === '/v1/request/callback/') {
      return new Response(JSON.stringify({
        status: 'success', from: u.searchParams.get('from'), to: u.searchParams.get('to'), time: 1730000000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.pathname === '/v1/info/balance/') {
      return new Response(JSON.stringify({ status: 'success', balance: 10.34, currency: 'EUR' }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 'error', message: 'no simulado' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return { fetchFalso, llamadas };
}

/** Un aviso de fin de llamada saliente, firmado como Zadarma (o no). */
function avisoSaliente({ pbx, extension = '101', destino = '34600111222', inicio = '2026-10-15 10:00:00', duracion = 125, estado = 'answered' }) {
  return {
    event: 'NOTIFY_OUT_END',
    call_start: inicio,
    pbx_call_id: pbx,
    caller_id: '34910000000',
    destination: destino,
    internal: extension,
    duration: String(duracion),
    disposition: estado,
    status_code: '16',
    is_recorded: '0',
    call_id_with_rec: '',
  };
}
const firmaDe = (c, secreto = SECRETO) => codificarFirma(`${c.internal}${c.destination}${c.call_start}`, secreto);
const enviarAviso = (cuerpo, firma) => request.post('/api/zadarma/webhook').type('form').set('Signature', firma).send(cuerpo);

beforeAll(async () => {
  A = await campus('Conectado');
  B = await campus('SinZadarma');
  ANA = await persona('Ana', 'gestor', [A, B], '101');
  DAYANA = await persona('Dayana', 'gestor', [A], '102');
  ADMIN = await persona('Admin', 'admin', [A, B]);
  L_ANA = await lead('ProspectoDeAna', A, ANA.id, '+34 600 111 222');
  L_DAYANA = await lead('ProspectoDeDayana', A, DAYANA.id, '+34 600 333 444');
  L_B = await lead('ProspectoEnB', B, ANA.id, '+34 600 555 666');
  // Las credenciales del campus A, cifradas como las guarda Integraciones.
  const k = encrypt(CLAVE);
  const s = encrypt(SECRETO);
  await q(`INSERT INTO project_integrations (project_id, provider, active, encrypted_value, iv, auth_tag, config_public)
           VALUES ($1, 'zadarma', true, $2, $3, $4, $5)`,
  [A, k.encrypted, k.iv, k.authTag, JSON.stringify({
    zona_horaria: 'Europe/Madrid',
    zadarma_secret_encrypted: s.encrypted, zadarma_secret_iv: s.iv, zadarma_secret_auth_tag: s.authTag,
  })]);
});

afterEach(() => { vi.unstubAllGlobals(); });

afterAll(async () => {
  await q('DELETE FROM llamadas WHERE project_id = ANY($1::int[])', [ids.projects]);
  await q('DELETE FROM llamadas_pedidas WHERE project_id = ANY($1::int[])', [ids.projects]);
  await q('DELETE FROM lead_interactions WHERE lead_id = ANY($1::int[])', [ids.leads]);
  await q('DELETE FROM lead_status_history WHERE lead_id = ANY($1::int[])', [ids.leads]).catch(() => {});
  await q('DELETE FROM lead_steps WHERE lead_id = ANY($1::int[])', [ids.leads]).catch(() => {});
  await q('DELETE FROM leads WHERE id = ANY($1::int[])', [ids.leads]);
  await q('DELETE FROM project_integrations WHERE project_id = ANY($1::int[])', [ids.projects]);
  await q('DELETE FROM user_projects WHERE user_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]);
});

describe('la firma de Zadarma (#137)', () => {
  it('es base64 del HMAC-SHA1 en hexadecimal, como hash_hmac de PHP', () => {
    // Hecho a mano, sin el código del módulo: lo que haría la librería oficial.
    const hex = crypto.createHmac('sha1', 'abc').update('hola').digest('hex');
    expect(codificarFirma('hola', 'abc')).toBe(Buffer.from(hex).toString('base64'));
    // Y NO la del binario, que es el error típico.
    expect(codificarFirma('hola', 'abc')).not.toBe(crypto.createHmac('sha1', 'abc').update('hola').digest('base64'));
  });

  it('firma metodo + params ordenados + md5(params)', () => {
    const { cadena, firma } = firmarPeticion('/v1/request/callback/', { to: '34600111222', from: '101', format: 'json' }, SECRETO);
    expect(cadena).toBe('format=json&from=101&to=34600111222');
    const md5 = crypto.createHash('md5').update(cadena).digest('hex');
    const hex = crypto.createHmac('sha1', SECRETO).update(`/v1/request/callback/${cadena}${md5}`).digest('hex');
    expect(firma).toBe(Buffer.from(hex).toString('base64'));
  });
});

describe('llamar (POST /api/zadarma/llamar)', () => {
  it('una gestora llama a SU prospecto: callback de su extensión al teléfono del lead, bien firmado', async () => {
    const { llamadas } = zadarmaSimulado();
    const r = await request.post('/api/zadarma/llamar').set(como(ANA)).send({ lead_id: L_ANA });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ extension: '101', numero: '+34600111222', lead_id: L_ANA });
    expect(llamadas).toHaveLength(1);
    const u = new URL(llamadas[0].url);
    expect(u.pathname).toBe('/v1/request/callback/');
    expect(u.searchParams.get('from')).toBe('101');
    expect(u.searchParams.get('to')).toBe('34600111222');
    const { firma } = firmarPeticion('/v1/request/callback/', { from: '101', to: '34600111222', format: 'json' }, SECRETO);
    expect(llamadas[0].headers.Authorization).toBe(`${CLAVE}:${firma}`);
    const pedidas = await q('SELECT user_id, lead_id, extension FROM llamadas_pedidas WHERE lead_id = $1', [L_ANA]);
    expect(pedidas).toEqual([{ user_id: ANA.id, lead_id: L_ANA, extension: '101' }]);
  });

  it('a un prospecto de otra gestora: 403, y a Zadarma no se le pide nada', async () => {
    const { fetchFalso } = zadarmaSimulado();
    const r = await request.post('/api/zadarma/llamar').set(como(ANA)).send({ lead_id: L_DAYANA });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('NO_ES_TUYO');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('en un campus sin Zadarma: 409 y no se llama', async () => {
    const { fetchFalso } = zadarmaSimulado();
    const r = await request.post('/api/zadarma/llamar').set(como(ANA)).send({ lead_id: L_B });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('ZADARMA_NO_CONECTADO');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('quien no tiene extensión en el campus: 409 SIN_EXTENSION', async () => {
    zadarmaSimulado();
    const r = await request.post('/api/zadarma/llamar').set(como(ADMIN)).send({ lead_id: L_DAYANA });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SIN_EXTENSION');
  });

  it('/estado solo lista los campus conectados, con la extensión de quien pregunta', async () => {
    const r = await request.get('/api/zadarma/estado').set(como(ANA));
    expect(r.status).toBe(200);
    const mios = r.body.data.filter((c) => ids.projects.includes(c.project_id));
    expect(mios).toEqual([{ project_id: A, extension: '101' }]);
  });
});

describe('el aviso de fin de llamada (POST /api/zadarma/webhook)', () => {
  it('responde el eco de Zadarma tal cual', async () => {
    const r = await request.get('/api/zadarma/webhook?zd_echo=abc123');
    expect(r.status).toBe(200);
    expect(r.text).toBe('abc123');
    expect((await request.get('/api/zadarma/webhook?zd_echo=<script>')).status).toBe(400);
  });

  it('con firma mala: 401 y no se guarda nada', async () => {
    const c = avisoSaliente({ pbx: `${MARCA}-mala` });
    const r = await enviarAviso(c, firmaDe(c, 'otro-secreto-cualquiera'));
    expect(r.status).toBe(401);
    expect(await q('SELECT 1 FROM llamadas WHERE pbx_call_id = $1', [`${MARCA}-mala`])).toHaveLength(0);
    // Y sin cabecera, igual.
    expect((await request.post('/api/zadarma/webhook').type('form').send(c)).status).toBe(401);
  });

  it('con firma buena: una llamada y un contacto en la ficha; repetido, nada más', async () => {
    const c = avisoSaliente({ pbx: `${MARCA}-1`, duracion: 125 });
    const r1 = await enviarAviso(c, firmaDe(c));
    expect(r1.status).toBe(200);
    expect(r1.body.data).toMatchObject({ leadId: L_ANA, userId: ANA.id });
    expect(r1.body.data.interaccionId).toBeTruthy();

    const r2 = await enviarAviso(c, firmaDe(c));
    expect(r2.status).toBe(200);
    expect(r2.body.data).toEqual({ duplicada: true });

    const filas = await q(`SELECT lead_id, user_id, direccion, duracion_seg, contestada,
                                  to_char(inicio AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS inicio
                             FROM llamadas WHERE pbx_call_id = $1`, [`${MARCA}-1`]);
    expect(filas).toEqual([{ lead_id: L_ANA, user_id: ANA.id, direccion: 'saliente', duracion_seg: 125, contestada: true, inicio: '2026-10-15 10:00' }]);
    const contactos = await q(`SELECT tipo, nota, created_by FROM lead_interactions
                                WHERE lead_id = $1 AND nota LIKE 'Llamada saliente por Zadarma%'`, [L_ANA]);
    expect(contactos).toHaveLength(1);
    expect(contactos[0]).toMatchObject({ tipo: 'llamada', created_by: ANA.id });
    expect(contactos[0].nota).toContain('2 min 05 s');
  });

  it('una llamada a un número de nadie queda sin lead y sin contacto', async () => {
    const c = avisoSaliente({ pbx: `${MARCA}-2`, destino: '34699999990', estado: 'no answer', duracion: 0 });
    const r = await enviarAviso(c, firmaDe(c));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ leadId: null, userId: ANA.id, interaccionId: null });
  });

  it('otros avisos se aceptan y se ignoran', async () => {
    const r = await request.post('/api/zadarma/webhook').type('form').send({ event: 'NOTIFY_START' });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ ignorado: true });
  });
});

describe('el reporte por gestora (GET /api/zadarma/reporte)', () => {
  beforeAll(async () => {
    // Dayana: una contestada de 60 s y una no contestada a su prospecto.
    for (const [pbx, dur, estado] of [[`${MARCA}-d1`, 60, 'answered'], [`${MARCA}-d2`, 0, 'busy']]) {
      const c = avisoSaliente({ pbx, extension: '102', destino: '34600333444', duracion: dur, estado, inicio: '2026-10-15 12:00:00' });
      await enviarAviso(c, firmaDe(c)).expect(200);
    }
  });

  const pedir = (u) => request.get(`/api/zadarma/reporte?desde=2026-10-15&hasta=2026-10-15&projectId=${A}`).set(como(u));

  it('el admin ve a cada una: llamadas, contestadas y duración', async () => {
    const r = await pedir(ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.data.conectado).toBe(true);
    const fila = (u) => r.body.data.filas.find((f) => f.user_id === u.id);
    expect(fila(ANA)).toMatchObject({ llamadas: 2, contestadas: 1, no_contestadas: 1, segundos: 125, media_segundos: 125 });
    expect(fila(DAYANA)).toMatchObject({ llamadas: 2, contestadas: 1, no_contestadas: 1, segundos: 60, media_segundos: 60 });
    expect(r.body.data.equipo).toMatchObject({ llamadas: 4, contestadas: 2, segundos: 185 });
  });

  it('una gestora solo se ve a sí misma', async () => {
    const r = await pedir(DAYANA);
    expect(r.status).toBe(200);
    expect(r.body.data.filas.map((f) => f.user_id)).toEqual([DAYANA.id]);
  });
});

describe('Integraciones: Zadarma se guarda cifrado y se prueba (como Stripe)', () => {
  it('sin el secreto no se guarda; con los dos, cifrado y la prueba usa el saldo', async () => {
    const SUPER = await persona('Super', 'superadmin', [B]);
    const sinSecreto = await request.put('/api/integrations').set(como(SUPER))
      .send({ projectId: B, provider: 'zadarma', api_key: 'una-clave-larga' });
    expect(sinSecreto.status).toBe(400);

    const ok = await request.put('/api/integrations').set(como(SUPER))
      .send({ projectId: B, provider: 'zadarma', api_key: 'una-clave-larga', api_secret: 'un-secreto-largo' });
    expect(ok.status).toBe(200);
    const [fila] = await q(`SELECT encrypted_value, config_public FROM project_integrations WHERE project_id = $1 AND provider = 'zadarma'`, [B]);
    expect(fila.encrypted_value).not.toContain('una-clave-larga');
    expect(JSON.stringify(fila.config_public)).not.toContain('un-secreto-largo');
    expect(fila.config_public.zadarma_secret_encrypted).toBeTruthy();

    const { llamadas } = zadarmaSimulado();
    const prueba = await request.post(`/api/integrations/zadarma/test?projectId=${B}`).set(como(SUPER));
    expect(prueba.body.data).toMatchObject({ ok: true });
    expect(new URL(llamadas[0].url).pathname).toBe('/v1/info/balance/');
    await q(`DELETE FROM project_integrations WHERE project_id = $1 AND provider = 'zadarma'`, [B]);
  });
});
