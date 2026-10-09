// Certifex · Diplomas (#272): el alumno pide su diploma desde Moodle, el CRM lo aprueba
// y emite, y una persona aprueba aparte el correo con el diploma.
//
// Aqui no se habla con ningun Certifex de verdad: `fetch` se sustituye por uno que
// apunta lo que se le pide y contesta como la API /api/crm/v1. Ningun correo sale.
//
// Lo que se fija:
//  · la entrada de solicitudes: secreto, idempotente por matricula, actualiza si el
//    alumno lo vuelve a pedir, enlaza con la ficha por correo y avisa SOLO a
//    administracion por la campana;
//  · que quien aprueba, emite, avisa, revoca o corrige es el usuario con sesion;
//  · que «aprobar y emitir» NO avisa: el aviso es otra llamada;
//  · que solo administracion puede, y que soporte no llega a Certifex.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const avisos = [];
vi.mock('../src/modules/notifications/notifications.service.js', async (orig) => ({
  ...(await orig()),
  notifyUsers: vi.fn(async (a) => { avisos.push(a); return { id: 1 }; }),
  notifyAdmins: vi.fn(async (a) => { avisos.push({ ...a, broadcast: true }); return { id: 1 }; }),
}));

const SECRETO = 'secreto-de-prueba-diplomas';
const CLAVE = 'cfx_crm_clave-de-prueba-diplomas';
process.env.CERTIFEX_WEBHOOK_SECRETO = SECRETO;
process.env.CERTIFEX_API_URL = 'https://certifex.test';
process.env.CERTIFEX_CRM_CLAVE = CLAVE;

const { default: supertest } = await import('supertest');
const { default: app } = await import('../src/app.js');
const { default: pool } = await import('../src/shared/config/db.js');
const { diaDe } = await import('../src/modules/certifex/certifex.diplomas.js');

const request = supertest(app);
// Ids de matricula altos y unicos por ejecucion, para no chocar con nada sembrado.
const base = 800000000 + Math.floor(Math.random() * 1000000);
let saToken;
let soporteToken;
let pedidas = [];
let responder = () => ({ status: 200, body: {} });

const fetchReal = globalThis.fetch;
beforeAll(async () => {
  const sa = await request.post('/api/auth/login').send({ email: 'manuel@empresa.com', password: 'CrmTemp2026!' });
  saToken = sa.body.data.accessToken;
  const { default: jwt } = await import('jsonwebtoken');
  soporteToken = jwt.sign({ userId: 999999, email: 'soporte@prueba.test', role: 'soporte', roles_extra: [] },
    process.env.JWT_SECRET, { expiresIn: '5m' });
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    if (!String(url).startsWith('https://certifex.test/')) return fetchReal(url, opts);
    const u = new URL(String(url));
    const p = { url: String(url), ruta: u.pathname.replace('/api/crm/v1', ''), query: Object.fromEntries(u.searchParams), metodo: opts.method, cabeceras: opts.headers, cuerpo: opts.body ? JSON.parse(opts.body) : null };
    pedidas.push(p);
    const r = responder(p);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
});
afterAll(async () => {
  globalThis.fetch = fetchReal;
  await pool.query('DELETE FROM certifex_solicitudes WHERE matricula_id >= $1 AND matricula_id < $2', [base, base + 1000]);
  await pool.end();
});
beforeEach(() => {
  pedidas = [];
  avisos.length = 0;
  responder = () => ({ status: 200, body: {} });
});

const sa = (req) => req.set('Authorization', `Bearer ${saToken}`);
const soporte = (req) => req.set('Authorization', `Bearer ${soporteToken}`);

const solicitud = (extra = {}) => ({
  matriculaId: base,
  centro: 'iseie',
  curso: { ref: 12, nombre: 'Máster en Prueba' },
  alumno: { nombreDiploma: 'María José Pérez Ruiz', nombreMoodle: 'maria perez', email: 'alumna.diploma@prueba.test' },
  solicitadaEn: '2026-10-08T10:00:00.000Z',
  ...extra,
});
const entregar = (cuerpo, secreto = SECRETO) => request.post('/api/certifex/solicitudes').set('X-Certifex-Secreto', secreto).send(cuerpo);

// ───────────────────────────────────────────────────────────── entrada

describe('POST /api/certifex/solicitudes (desde el servidor de Certifex)', () => {
  it('sin el secreto configurado la entrada no existe (404); con otro, 401', async () => {
    delete process.env.CERTIFEX_WEBHOOK_SECRETO;
    try {
      expect((await entregar(solicitud())).status).toBe(404);
    } finally {
      process.env.CERTIFEX_WEBHOOK_SECRETO = SECRETO;
    }
    expect((await request.post('/api/certifex/solicitudes').send(solicitud())).status).toBe(401);
    expect((await entregar(solicitud(), 'otro')).status).toBe(401);
    expect(avisos).toHaveLength(0);
  });

  it('se guarda, se enlaza con la ficha por correo y suena la campana de administracion', async () => {
    const { rows: [lead] } = await pool.query(
      `INSERT INTO leads (project_id, nombre, email) VALUES (1, 'Alumna Diploma', 'ALUMNA.DIPLOMA@prueba.test') RETURNING id`);
    try {
      const r = await entregar(solicitud());
      expect(r.status).toBe(201);
      expect(r.body.data).toMatchObject({ estado: 'nueva', duplicada: false, enCrm: true });

      const { rows: [s] } = await pool.query('SELECT * FROM certifex_solicitudes WHERE matricula_id = $1', [base]);
      expect(s).toMatchObject({ centro: 'ISEIE', nombre_diploma: 'María José Pérez Ruiz', nombre_moodle: 'maria perez', lead_id: lead.id, veces: 1 });

      await vi.waitFor(() => expect(avisos).toHaveLength(1));
      const a = avisos[0];
      expect(a.type).toBe('certifex_solicitud');
      expect(a.link_path).toBe('/clientes/matriculas/diplomas');
      expect(a.title).toContain('María José Pérez Ruiz');
      expect(a.message).toContain('en Moodle: maria perez');
      expect(a.metadata).toMatchObject({ matriculaId: base, leadId: lead.id });
      // Dirigida: solo a usuarios de administracion, no al reparto general (que ve soporte).
      const { rows } = await pool.query(
        `SELECT id FROM users WHERE active AND (role IN ('admin','superadmin') OR roles_extra && ARRAY['admin','superadmin']::user_role[])`);
      expect([...a.targetUserIds].sort()).toEqual(rows.map((x) => x.id).sort());
      expect(a.broadcast).toBeUndefined();
    } finally {
      await pool.query('UPDATE certifex_solicitudes SET lead_id = NULL WHERE lead_id = $1', [lead.id]);
      await pool.query('DELETE FROM leads WHERE id = $1', [lead.id]);
    }
  });

  it('un reintento identico de Certifex no duplica ni vuelve a avisar', async () => {
    const r = await entregar(solicitud());
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ estado: 'repetida', duplicada: true });
    await new Promise((ok) => setTimeout(ok, 50));
    expect(avisos).toHaveLength(0);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM certifex_solicitudes WHERE matricula_id = $1', [base]);
    expect(rows[0].n).toBe(1);
  });

  it('si el alumno lo vuelve a pedir, se actualiza la que hay y avisa otra vez', async () => {
    await pool.query(`UPDATE certifex_solicitudes SET aviso_rechazo_en = NOW(), aviso_rechazo_por = 'x' WHERE matricula_id = $1`, [base]);
    const r = await entregar(solicitud({
      solicitadaEn: '2026-10-09T09:00:00.000Z',
      alumno: { nombreDiploma: 'María José Pérez Ruiz de la Vega', nombreMoodle: 'maria perez', email: 'alumna.diploma@prueba.test' },
    }));
    expect(r.status).toBe(200);
    expect(r.body.data.estado).toBe('actualizada');
    const { rows: [s] } = await pool.query('SELECT * FROM certifex_solicitudes WHERE matricula_id = $1', [base]);
    expect(s.nombre_diploma).toBe('María José Pérez Ruiz de la Vega');
    expect(s.veces).toBe(2);
    // El aviso de rechazo era de la solicitud anterior.
    expect(s.aviso_rechazo_en).toBeNull();
    await vi.waitFor(() => expect(avisos).toHaveLength(1));
    expect(avisos[0].title).toMatch(/vuelve a pedir/);
  });

  it('sin DNI: si llega uno, no se guarda; sin nombre, no entra', async () => {
    const r = await entregar(solicitud({ matriculaId: base + 1, alumno: { nombreDiploma: 'Ana Gil', email: null, dni: '12345678Z' } }));
    expect(r.status).toBe(201);
    expect(r.body.data.enCrm).toBe(false);
    const { rows: [s] } = await pool.query('SELECT * FROM certifex_solicitudes WHERE matricula_id = $1', [base + 1]);
    expect(JSON.stringify(s)).not.toContain('12345678Z');
    expect((await entregar(solicitud({ matriculaId: base + 2, alumno: { nombreDiploma: '', email: null } }))).status).toBe(400);
    expect((await entregar(solicitud({ matriculaId: base + 3, solicitadaEn: 'ayer' }))).status).toBe(400);
  });
});

// ───────────────────────────────────────────────────────────── permisos

describe('quien puede', () => {
  it('sin sesion, nada', async () => {
    expect((await request.get('/api/certifex/diplomas')).status).toBe(401);
    expect((await request.post('/api/certifex/diplomas/aprobar-emitir').send({ matriculaIds: [1] })).status).toBe(401);
    expect(pedidas).toHaveLength(0);
  });

  it('soporte no ve ni toca diplomas: 403 y nada llega a Certifex', async () => {
    const llamadas = [
      soporte(request.get('/api/certifex/diplomas')),
      soporte(request.get('/api/certifex/diplomas/solicitudes')),
      soporte(request.get('/api/certifex/diplomas/resumen')),
      soporte(request.get('/api/certifex/diplomas/por-avisar')),
      soporte(request.post('/api/certifex/diplomas/aprobar-emitir')).send({ matriculaIds: [7] }),
      soporte(request.post('/api/certifex/diplomas/rechazar')).send({ matriculaIds: [7], motivo: 'no pagó' }),
      soporte(request.post('/api/certifex/diplomas/avisos')).send({ nexpedientes: ['CTF-2026-000001-AAAA'] }),
      soporte(request.post('/api/certifex/diplomas/avisos-rechazo')).send({ matriculaIds: [7] }),
      soporte(request.post('/api/certifex/diplomas/revocar')).send({ nexpediente: 'CTF-2026-000001-AAAA', motivo: 'error' }),
      soporte(request.post('/api/certifex/diplomas/corregir')).send({ nexpediente: 'CTF-2026-000001-AAAA', valor: 'Ana', motivo: 'tilde' }),
    ];
    for (const r of await Promise.all(llamadas)) expect(r.status).toBe(403);
    expect(pedidas).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────── listados

const candidato = (id, en, extra = {}) => ({
  matriculaId: id, centro: 'ISEIE', titular: { nombre: `Alumno ${id}`, email: null, dni: null },
  curso: { ref: 12, nombre: 'Máster' }, notaFinal: 8, umbral: 5, completado: true, actividades: { total: 4, calificadas: 4 },
  propuesto: true, nexpediente: null, solicitud: { en, nombre: `Nombre Diploma ${id}` }, decision: null, ...extra,
});
const diploma = (nexpediente, emitidoEn, extra = {}) => ({
  nexpediente, centro: 'ISEIE', alumno: 'Alumno', titulacion: 'Máster', cursoRef: 12, emitidoEn, emitidaPor: 'x',
  revocada: false, revocacion: null, verificarUrl: `https://certifex.test/c/${nexpediente}`, diplomaUrl: 'https://certifex.test/diploma', aviso: null, ...extra,
});

describe('solicitudes', () => {
  it('pide solo lo solicitado desde Moodle, con sus filtros, y cruza con el CRM', async () => {
    responder = () => ({ status: 200, body: { filas: [candidato(7, '2026-10-08T10:00:00Z')], total: 1, pagina: 1, tam: 50 } });
    const r = await sa(request.get('/api/certifex/diplomas/solicitudes?centro=iseie&curso=12&q=ana'));
    expect(r.status).toBe(200);
    expect(pedidas[0].ruta).toBe('/candidatos');
    expect(pedidas[0].query).toEqual({ estado: 'pendiente', solicitadas: '1', centro: 'ISEIE', curso: '12', q: 'ana', pagina: '1', tam: '50' });
    expect(pedidas[0].cabeceras.Authorization).toBe(`Bearer ${CLAVE}`);
    expect(r.body.data.filas[0]).toMatchObject({ matriculaId: 7, crm: null, solicitud: { nombre: 'Nombre Diploma 7' } });
    expect(JSON.stringify(r.body)).not.toContain(CLAVE);
  });

  it('con fechas, recorre las paginas de Certifex y deja de pedir al pasar de `desde`', async () => {
    // 200 por pagina, lo mas reciente primero: la segunda pagina ya cruza el 01/10.
    const pag1 = Array.from({ length: 200 }, (_, i) => candidato(1000 + i, '2026-10-05T10:00:00Z'));
    const pag2 = [candidato(2000, '2026-10-02T10:00:00Z'), candidato(2001, '2026-09-20T10:00:00Z'), candidato(2002, '2026-09-10T10:00:00Z')];
    responder = (p) => ({ status: 200, body: { filas: p.query.pagina === '1' ? pag1 : p.query.pagina === '2' ? [...pag2, ...pag1.slice(0, 197)] : [], total: 1000, pagina: Number(p.query.pagina), tam: 200 } });
    const r = await sa(request.get('/api/certifex/diplomas/solicitudes?desde=2026-10-01&hasta=2026-10-04&pagina=1&tam=50'));
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.filas.map((f) => f.matriculaId)).toEqual([2000]);
    expect(pedidas.map((p) => p.query.pagina)).toEqual(['1', '2']);
  });

  it('las rechazadas traen el aviso de rechazo que se aprobo', async () => {
    await pool.query(
      `INSERT INTO certifex_solicitudes (matricula_id, aviso_rechazo_en, aviso_rechazo_por, aviso_rechazo_resultado)
       VALUES ($1, NOW(), 'manuel@empresa.com', 'enviado') ON CONFLICT (matricula_id) DO NOTHING`, [base + 10]);
    responder = () => ({ status: 200, body: { filas: [
      candidato(base + 10, '2026-10-08T10:00:00Z', { decision: { decision: 'rechazada', motivo: 'Sin pagar', decididoPor: 'x', decididoEn: '2026-10-08T11:00:00Z', refExterna: null } }),
      candidato(base + 11, '2026-10-08T10:00:00Z', { decision: { decision: 'rechazada', motivo: 'Baja', decididoPor: 'x', decididoEn: '2026-10-08T11:00:00Z', refExterna: null } }),
    ], total: 2, pagina: 1, tam: 50 } });
    const r = await sa(request.get('/api/certifex/diplomas/solicitudes?estado=rechazada'));
    const [a, b] = r.body.data.filas;
    expect(a.avisoRechazo).toMatchObject({ por: 'manuel@empresa.com', resultado: 'enviado' });
    expect(b.avisoRechazo).toBeNull();
  });

  it('un filtro raro no llega a Certifex', async () => {
    expect((await sa(request.get('/api/certifex/diplomas/solicitudes?estado=emitidas'))).status).toBe(400);
    expect((await sa(request.get('/api/certifex/diplomas/solicitudes?desde=08/10/2026'))).status).toBe(400);
    expect(pedidas).toHaveLength(0);
  });
});

describe('diplomas emitidos', () => {
  it('vigentes o revocados, tal cual, con su paginacion', async () => {
    responder = () => ({ status: 200, body: { filas: [diploma('CTF-2026-000001-AAAA', '2026-10-08T10:00:00Z')], total: 1, pagina: 2, tam: 20 } });
    const r = await sa(request.get('/api/certifex/diplomas?estado=revocados&centro=ISEIE&pagina=2&tam=20'));
    expect(r.status).toBe(200);
    expect(pedidas[0].ruta).toBe('/diplomas');
    expect(pedidas[0].query).toEqual({ estado: 'revocados', centro: 'ISEIE', pagina: '2', tam: '20' });
  });

  it('filtra por estado del aviso y por formacion en el CRM, y la formacion pide campus', async () => {
    responder = () => ({ status: 200, body: { filas: [
      diploma('CTF-2026-000001-AAAA', '2026-10-08T10:00:00Z'),
      diploma('CTF-2026-000002-AAAA', '2026-10-08T10:00:00Z', { aviso: { resultado: 'enviado', en: 'x', por: 'y' } }),
      diploma('CTF-2026-000003-AAAA', '2026-10-08T10:00:00Z', { aviso: { resultado: 'correo_apagado', en: 'x', por: 'y' } }),
      diploma('CTF-2026-000004-AAAA', '2026-10-08T10:00:00Z', { cursoRef: 99 }),
    ], total: 4, pagina: 1, tam: 200 } });
    const pend = await sa(request.get('/api/certifex/diplomas?aviso=pendiente&centro=ISEIE&curso=12'));
    expect(pend.body.data.filas.map((d) => d.nexpediente)).toEqual(['CTF-2026-000001-AAAA']);
    const no = await sa(request.get('/api/certifex/diplomas?aviso=no_salio'));
    expect(no.body.data.filas.map((d) => d.nexpediente)).toEqual(['CTF-2026-000003-AAAA']);
    const todo = await sa(request.get('/api/certifex/diplomas?todo=1'));
    expect(todo.body.data.filas).toHaveLength(4);
    expect((await sa(request.get('/api/certifex/diplomas?curso=12'))).status).toBe(400);
  });

  it('por avisar: aprobadas con diploma vigente y sin aviso; y las aprobadas sin diploma', async () => {
    responder = (p) => {
      if (p.ruta === '/candidatos') {
        return { status: 200, body: { filas: [
          candidato(1, '2026-10-07T10:00:00Z', { nexpediente: 'CTF-2026-000001-AAAA' }),
          candidato(2, '2026-10-07T10:00:00Z', { nexpediente: 'CTF-2026-000002-AAAA' }),
          candidato(3, '2026-10-07T10:00:00Z'),
        ], total: 3, pagina: 1, tam: 200 } };
      }
      return { status: 200, body: { filas: [
        diploma('CTF-2026-000001-AAAA', '2026-10-08T10:00:00Z'),
        diploma('CTF-2026-000002-AAAA', '2026-10-08T10:00:00Z', { aviso: { resultado: 'enviado', en: 'x', por: 'y' } }),
      ], total: 2, pagina: 1, tam: 200 } };
    };
    const r = await sa(request.get('/api/certifex/diplomas/por-avisar'));
    expect(r.status).toBe(200);
    expect(pedidas[0].query).toMatchObject({ estado: 'aprobada', solicitadas: '1' });
    expect(r.body.data.porAvisar.map((c) => c.matriculaId)).toEqual([1]);
    expect(r.body.data.porAvisar[0].diploma.nexpediente).toBe('CTF-2026-000001-AAAA');
    expect(r.body.data.sinEmitir.map((c) => c.matriculaId)).toEqual([3]);
  });

  it('el resumen cuenta cada pestaña', async () => {
    responder = (p) => {
      if (p.query.tam === '1') {
        const t = { pendiente: 4, rechazada: 2, vigentes: 30, revocados: 1 }[p.query.estado];
        return { status: 200, body: { filas: [], total: t, pagina: 1, tam: 1 } };
      }
      return { status: 200, body: { filas: [], total: 0, pagina: 1, tam: 200 } };
    };
    const r = await sa(request.get('/api/certifex/diplomas/resumen?centro=ISEIE'));
    expect(r.body.data).toEqual({ pendientes: 4, rechazadas: 2, vigentes: 30, revocados: 1, porAvisar: 0, sinEmitir: 0 });
    expect(pedidas.every((p) => p.query.centro === 'ISEIE')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────── acciones

describe('aprobar y emitir', () => {
  it('aprueba y emite en un paso, a nombre del usuario con sesion, y NO avisa', async () => {
    responder = (p) => p.ruta === '/decisiones'
      ? { status: 200, body: { resultados: [{ matriculaId: 7, ok: true, decision: 'aprobada' }, { matriculaId: 8, ok: false, error: 'Ya está rechazada' }] } }
      : { status: 200, body: { resultados: [{ matriculaId: 7, ok: true, nexpediente: 'CTF-2026-000007-AAAA' }] } };
    const r = await sa(request.post('/api/certifex/diplomas/aprobar-emitir'))
      .send({ matriculaIds: [7, 8], decididoPor: 'otra@persona.test', emitidaPor: 'otra@persona.test' });
    expect(r.status).toBe(200);
    expect(pedidas.map((p) => p.ruta)).toEqual(['/decisiones', '/emitir']);
    expect(pedidas[0].cuerpo.decisiones).toEqual([
      { matriculaId: 7, decision: 'aprobada', decididoPor: 'manuel@empresa.com' },
      { matriculaId: 8, decision: 'aprobada', decididoPor: 'manuel@empresa.com' },
    ]);
    // Solo se emite lo que se aprobo.
    expect(pedidas[1].cuerpo).toEqual({ matriculaIds: [7], emitidaPor: 'manuel@empresa.com' });
    expect(r.body.data.resultados).toEqual([
      { matriculaId: 7, ok: true, nexpediente: 'CTF-2026-000007-AAAA', fase: 'emitir' },
      { matriculaId: 8, ok: false, fase: 'aprobar', error: 'Ya está rechazada' },
    ]);
    expect(pedidas.some((p) => p.ruta.startsWith('/avisos'))).toBe(false);
  });

  it('si la emision falla, se dice que quedo aprobada sin diploma', async () => {
    responder = (p) => p.ruta === '/decisiones'
      ? { status: 200, body: { resultados: [{ matriculaId: 7, ok: true }] } }
      : { status: 500, body: { error: 'Moodle no responde' } };
    const r = await sa(request.post('/api/certifex/diplomas/aprobar-emitir')).send({ matriculaIds: [7] });
    expect(r.status).toBe(200);
    expect(r.body.data.resultados[0]).toMatchObject({ matriculaId: 7, ok: false, fase: 'emitir' });
    expect(r.body.data.resultados[0].error).toMatch(/Aprobada, pero sin diploma: Moodle no responde/);
  });

  it('mas de 10 por llamada no sale (se hace en tandas)', async () => {
    const r = await sa(request.post('/api/certifex/diplomas/aprobar-emitir')).send({ matriculaIds: Array.from({ length: 11 }, (_, i) => i + 1) });
    expect(r.status).toBe(400);
    expect(pedidas).toHaveLength(0);
  });
});

describe('rechazar', () => {
  it('el motivo es obligatorio', async () => {
    expect((await sa(request.post('/api/certifex/diplomas/rechazar')).send({ matriculaIds: [7] })).status).toBe(400);
    expect((await sa(request.post('/api/certifex/diplomas/rechazar')).send({ matriculaIds: [7], motivo: '  ' })).status).toBe(400);
    expect(pedidas).toHaveLength(0);
  });

  it('rechaza con motivo a nombre del usuario con sesion, sin avisar', async () => {
    responder = () => ({ status: 200, body: { resultados: [{ matriculaId: 7, ok: true }] } });
    const r = await sa(request.post('/api/certifex/diplomas/rechazar')).send({ matriculaIds: [7], motivo: 'No ha pagado', decididoPor: 'x' });
    expect(r.status).toBe(200);
    expect(pedidas).toHaveLength(1);
    expect(pedidas[0].cuerpo).toEqual({ decisiones: [{ matriculaId: 7, decision: 'rechazada', motivo: 'No ha pagado', decididoPor: 'manuel@empresa.com' }] });
  });
});

describe('avisos: el correo al alumno solo sale si alguien lo aprueba', () => {
  it('«Enviar diploma al alumno» aprueba el aviso a nombre del usuario con sesion', async () => {
    responder = () => ({ status: 200, body: { correoActivo: false, resultados: [{ nexpediente: 'CTF-2026-000001-AAAA', ok: false, resultado: 'correo_apagado' }] } });
    const r = await sa(request.post('/api/certifex/diplomas/avisos')).send({ nexpedientes: ['ctf-2026-000001-aaaa'], aprobadoPor: 'otra@persona.test' });
    expect(r.status).toBe(200);
    expect(pedidas[0].ruta).toBe('/avisos');
    expect(pedidas[0].cuerpo).toEqual({ nexpedientes: ['CTF-2026-000001-AAAA'], aprobadoPor: 'manuel@empresa.com' });
    // Con el correo apagado en Certifex, la pantalla tiene que poder decirlo.
    expect(r.body.data.correoActivo).toBe(false);
  });

  it('un numero de expediente con otra forma no sale; mas de 50, tampoco', async () => {
    expect((await sa(request.post('/api/certifex/diplomas/avisos')).send({ nexpedientes: ['../../x'] })).status).toBe(400);
    const muchos = Array.from({ length: 51 }, (_, i) => `CTF-2026-${String(i).padStart(6, '0')}-AAAA`);
    expect((await sa(request.post('/api/certifex/diplomas/avisos')).send({ nexpedientes: muchos })).status).toBe(400);
    expect(pedidas).toHaveLength(0);
  });

  it('el aviso de rechazo se aprueba aparte y queda apuntado quien y cuando', async () => {
    responder = () => ({ status: 200, body: { correoActivo: true, resultados: [{ matriculaId: base + 20, ok: true, resultado: 'enviado' }, { matriculaId: base + 21, ok: false, error: 'No está rechazada' }] } });
    const r = await sa(request.post('/api/certifex/diplomas/avisos-rechazo')).send({ matriculaIds: [base + 20, base + 21] });
    expect(r.status).toBe(200);
    expect(pedidas[0].ruta).toBe('/avisos-rechazo');
    expect(pedidas[0].cuerpo).toEqual({ matriculaIds: [base + 20, base + 21], aprobadoPor: 'manuel@empresa.com' });
    const { rows } = await pool.query('SELECT matricula_id, aviso_rechazo_por, aviso_rechazo_resultado FROM certifex_solicitudes WHERE matricula_id = ANY($1::bigint[])', [[base + 20, base + 21]]);
    expect(rows).toEqual([{ matricula_id: String(base + 20), aviso_rechazo_por: 'manuel@empresa.com', aviso_rechazo_resultado: 'enviado' }]);
  });
});

describe('revocar y corregir', () => {
  it('revocar pide motivo y va a nombre del usuario con sesion', async () => {
    expect((await sa(request.post('/api/certifex/diplomas/revocar')).send({ nexpediente: 'CTF-2026-000001-AAAA' })).status).toBe(400);
    responder = () => ({ status: 200, body: { ok: true, nexpediente: 'CTF-2026-000001-AAAA' } });
    const r = await sa(request.post('/api/certifex/diplomas/revocar')).send({ nexpediente: 'CTF-2026-000001-AAAA', motivo: 'Emitido por error', revocadaPor: 'x' });
    expect(r.status).toBe(200);
    expect(pedidas[0].cuerpo).toEqual({ nexpediente: 'CTF-2026-000001-AAAA', motivo: 'Emitido por error', revocadaPor: 'manuel@empresa.com' });
  });

  it('corregir el nombre: mismo numero, campo alumno_nombre por defecto, auditado a nombre de quien corrige', async () => {
    responder = () => ({ status: 200, body: { ok: true, nexpediente: 'CTF-2026-000001-AAAA' } });
    const r = await sa(request.post('/api/certifex/diplomas/corregir'))
      .send({ nexpediente: 'CTF-2026-000001-AAAA', valor: 'María José Pérez', motivo: 'Faltaba la tilde', corregidoPor: 'x' });
    expect(r.status).toBe(200);
    expect(pedidas[0].ruta).toBe('/corregir');
    expect(pedidas[0].cuerpo).toEqual({ nexpediente: 'CTF-2026-000001-AAAA', campo: 'alumno_nombre', valor: 'María José Pérez', motivo: 'Faltaba la tilde', corregidoPor: 'manuel@empresa.com' });
  });

  it('el error de Certifex llega tal cual a la pantalla', async () => {
    responder = () => ({ status: 400, body: { error: 'Está revocado: no se corrige.' } });
    const r = await sa(request.post('/api/certifex/diplomas/corregir')).send({ nexpediente: 'CTF-2026-000001-AAAA', valor: 'Ana', motivo: 'tilde' });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('Está revocado: no se corrige.');
  });
});

describe('fechas', () => {
  it('el dia se cuenta en hora de Madrid', () => {
    expect(diaDe('2026-10-07T22:30:00Z')).toBe('2026-10-08');
    expect(diaDe(null)).toBeNull();
  });
});
