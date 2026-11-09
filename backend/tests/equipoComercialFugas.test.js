import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Las fugas del equipo comercial (QA del 09/11/2026, #704).
 *
 * Una administradora que lleva un equipo (filas en `equipo_comercial`) ve lo
 * suyo y lo de sus gestoras, y nada más. El QA en pantalla encontró sitios que
 * se quedaron fuera del primer cambio: el último lead de cada gestora, el panel
 * de Finanzas, la cola de facturación, las tarjetas y el detalle de Facturas,
 * WhatsApp y `/auth/me`. Y que una líder no pueda ampliarse a sí misma.
 *
 * Una prueba por fuga, contra la base LOCAL (tests/setup.js) y con las rutas
 * de verdad.
 *
 *   npx vitest run tests/equipoComercialFugas.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');
const { gestorasACargo } = await import('../src/shared/utils/roles.js');
const { usuarioObjetivo } = await import('../src/modules/whatsapp/chat.controller.js');
const modulos = await Promise.all(['auth', 'users', 'projects', 'accounting', 'invoices', 'whatsapp', 'permissions',
  'reports', 'proceso', 'convocatorias']
  .map((m) => import(`../src/modules/${m}/index.js`).then((x) => x.default)));

const app = express();
app.use(express.json());
for (const m of modulos) app.use(m.prefix, m.router);
app.use(errorHandler);
const request = supertest(app);

const MARCA = `EQF${Date.now().toString(36)}`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const one = async (sql, p) => (await q(sql, p))[0];
const ids = { users: [], projects: [], issuers: [], leads: [], ventas: [], facturas: [] };

let EMPRESA; let A; let B;
let SUPER; let LIDER; let ADMIN; let G1; let G2; let G3;
let V1; let V2; let P1; let P2; let F1; let F2; let L1; let L2;

const como = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' })}` });
const pedir = (u, ruta) => request.get(ruta).set(como(u));

beforeAll(async () => {
  const e = await one('INSERT INTO invoice_issuers (razon_social, nif) VALUES ($1, $2) RETURNING id',
    [`${MARCA} cedia`, `B9${Date.now().toString().slice(-7)}`]);
  ids.issuers.push(e.id); EMPRESA = e.id;
  const campus = async (n) => {
    const p = await one(`INSERT INTO projects (nombre, slug, webhook_api_key, sociedad_emisora_id)
                         VALUES ($1, $2, $3, $4) RETURNING id`,
      [`${MARCA} ${n}`, `${MARCA.toLowerCase()}-${n}`, `${MARCA}-k-${n}`, EMPRESA]);
    ids.projects.push(p.id); return p.id;
  };
  A = await campus('a'); B = await campus('b');

  const persona = async (n, role, suyos) => {
    const u = await one(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role`,
      [`${MARCA} ${n}`, `${n}@${MARCA.toLowerCase()}.test`, role]);
    ids.users.push(u.id);
    for (const c of suyos) await q('INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)', [u.id, c]);
    return u;
  };
  SUPER = await persona('super', 'superadmin', []);
  LIDER = await persona('raquel', 'admin', [A, B]);      // lleva a G1 y G3
  ADMIN = await persona('daniela', 'admin', [A, B]);     // sin equipo: todo
  G1 = await persona('g1', 'gestor', [A]);
  G2 = await persona('g2', 'gestor', [A]);               // de fuera del equipo
  G3 = await persona('g3', 'gestor', [B]);
  await q('INSERT INTO equipo_comercial (lider_id, gestora_id) VALUES ($1, $2), ($1, $3)', [LIDER.id, G1.id, G3.id]);
  // «Emitir desde la cola» no lo trae nadie de serie: se le da a la líder para
  // probar que, aun con él, solo toca lo de su equipo.
  await q(`INSERT INTO user_permission_overrides (user_id, resource, action, allowed)
           VALUES ($1, 'facturas', 'cola', true)`, [LIDER.id]);

  const lead = async (n, responsable) => {
    const l = await one(`INSERT INTO leads (project_id, nombre, email, responsable_id, fecha_solicitud)
                         VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [A, `${MARCA} ${n}`, `${n}@${MARCA.toLowerCase()}.test`, responsable]);
    ids.leads.push(l.id); return l.id;
  };
  L1 = await lead('l1', G1.id);
  L2 = await lead('l2', G2.id);

  // Dos ventas con su cobro de hoy y algo pendiente.
  const venta = async (leadId, vendedora, total) => {
    const v = await one(`INSERT INTO conversions (lead_id, project_id, producto_contratado, importe_total, vendedora_id)
                         VALUES ($1, $2, 'Curso', $3, $4) RETURNING id`, [leadId, A, total, vendedora]);
    ids.ventas.push(v.id);
    const p = await one(`INSERT INTO conversion_payments (conversion_id, importe, fecha) VALUES ($1, 100, CURRENT_DATE) RETURNING id`, [v.id]);
    await q('UPDATE conversions SET importe_pagado = 100 WHERE id = $1', [v.id]);
    return [v.id, p.id];
  };
  [V1, P1] = await venta(L1, G1.id, 150);
  [V2, P2] = await venta(L2, G2.id, 200);

  // Una factura emitida de cada venta (por menos de lo cobrado: los cobros
  // siguen en la cola).
  const factura = async (venta, leadId, total, n) => {
    const f = await one(`INSERT INTO invoices (project_id, ano, cliente_nombre, cliente_nif, cliente_direccion,
                            cliente_ciudad, cliente_cp, cliente_pais, items, base_imponible, total, conversion_id, lead_id,
                            serie, numero, codigo, estado, fecha_emision)
                          VALUES ($1, EXTRACT(YEAR FROM CURRENT_DATE)::int, 'Cliente', 'X', 'Calle', 'Ciudad', '00000', 'ES',
                            '[]'::jsonb, $2, $2, $3, $4, $5, $6, $7, 'emitida', CURRENT_DATE)
                          RETURNING id`, [A, total, venta, leadId, MARCA.slice(0, 10), n, `${MARCA}-${n}`]);
    ids.facturas.push(f.id); return f.id;
  };
  F1 = await factura(V1, L1, 21, 1);
  F2 = await factura(V2, L2, 40, 2);
}, 60000);

afterAll(async () => {
  await q('DELETE FROM equipo_comercial WHERE lider_id = ANY($1::int[]) OR gestora_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM user_permission_overrides WHERE user_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM permisos_registro WHERE usuario_id = ANY($1::int[]) OR quien_id = ANY($1::int[])', [ids.users]).catch(() => {});
  await q('DELETE FROM user_activity_log WHERE user_id = ANY($1::int[])', [ids.users]).catch(() => {});
  await q('DELETE FROM invoices WHERE id = ANY($1::int[])', [ids.facturas]);
  await q('DELETE FROM conversion_payments WHERE conversion_id = ANY($1::int[])', [ids.ventas]);
  await q('DELETE FROM conversions WHERE id = ANY($1::int[])', [ids.ventas]);
  await q('DELETE FROM leads WHERE id = ANY($1::int[])', [ids.leads]);
  await q('DELETE FROM user_projects WHERE user_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]);
  await q('DELETE FROM invoice_issuers WHERE id = ANY($1::int[])', [ids.issuers]);
  await pool.end();
}, 60000);

describe('1 · último lead de cada gestora', () => {
  it('la líder ve solo a su equipo; la admin sin equipo, a todas', async () => {
    const r = await pedir(LIDER, `/api/projects/${A}/ultimo-lead`);
    expect(r.status).toBe(200);
    const suyas = r.body.data.gestoras.map((g) => Number(g.id));
    expect(suyas).toContain(G1.id);
    expect(suyas).not.toContain(G2.id);
    expect(JSON.stringify(r.body.data)).not.toContain(`${MARCA} l2`);
    expect(r.body.data.sin_responsable).toBe(0);
    // Con la empresa arriba («Todos» de esa empresa), igual.
    const empresa = await pedir(LIDER, `/api/projects/-1/ultimo-lead?issuerId=${EMPRESA}`);
    expect(empresa.body.data.gestoras.map((g) => Number(g.id))).not.toContain(G2.id);
    const admin = await pedir(ADMIN, `/api/projects/${A}/ultimo-lead`);
    expect(admin.body.data.gestoras.map((g) => Number(g.id))).toEqual(expect.arrayContaining([G1.id, G2.id]));
  });
});

describe('2 · Finanzas › Dashboard', () => {
  const ruta = (extra) => `/api/accounting/dashboard?from=2000-01-01&to=2999-12-31&${extra}`;

  it('la líder: cobrado, facturado y por cobrar de su equipo; sin egresos ni balance', async () => {
    const r = await pedir(LIDER, ruta(`projectId=${A}`));
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.ingresos.total_cobrado).toBe(100);            // solo el cobro de G1
    expect(d.ingresos.total_facturado).toBe(150);
    expect(d.ingresos.total_emitido).toBe(21);              // solo F1
    expect(d.cuentas_por_cobrar.map((c) => c.id)).toEqual([V1]);
    expect(d.cuentas_por_cobrar_resumen).toMatchObject({ num: 1, total: 50 });
    expect(d.solo_equipo).toBe(true);
    expect(d.egresos).toMatchObject({ total: 0, oculto: true, por_categoria: [] });
    expect(d.balance).toBeNull();
    expect(d.trend.egresos).toEqual([]);
  });

  it('con la empresa arriba, igual de recortado', async () => {
    const r = await pedir(LIDER, ruta(`issuerId=${EMPRESA}`));
    expect(r.status).toBe(200);
    expect(r.body.data.ingresos.total_cobrado).toBe(100);
    expect(r.body.data.cuentas_por_cobrar.map((c) => c.id)).not.toContain(V2);
  });

  it('la admin sin equipo lo ve todo, con egresos y balance', async () => {
    const r = await pedir(ADMIN, ruta(`projectId=${A}`));
    const d = r.body.data;
    expect(d.ingresos.total_cobrado).toBe(200);
    expect(d.ingresos.total_emitido).toBe(61);
    expect(d.cuentas_por_cobrar.map((c) => c.id)).toEqual(expect.arrayContaining([V1, V2]));
    expect(d.solo_equipo).toBe(false);
    expect(d.egresos.oculto).toBe(false);
    expect(typeof d.balance).toBe('number');
  });
});

describe('3 · cola de facturación', () => {
  it('la líder ve solo los cobros de su equipo; la admin, todos', async () => {
    const r = await pedir(LIDER, `/api/invoices/facturacion-al-dia?projectId=${A}`);
    expect(r.status).toBe(200);
    const cobros = r.body.data.cola.map((c) => c.payment_id);
    expect(cobros).toContain(P1);
    expect(cobros).not.toContain(P2);
    expect(r.body.data.pagos_sin_factura).toBe(1);
    const admin = await pedir(ADMIN, `/api/invoices/facturacion-al-dia?projectId=${A}`);
    expect(admin.body.data.cola.map((c) => c.payment_id)).toEqual(expect.arrayContaining([P1, P2]));
  });

  it('con «Emitir desde la cola», no factura un cobro de fuera ni mueve la fecha «al día»', async () => {
    const fuera = await request.post('/api/invoices/cola/generar').set(como(LIDER))
      .send({ projectId: A, paymentId: P2, forzar: true });
    expect(fuera.status).toBe(404);
    expect(fuera.body.code).toBe('NOT_IN_QUEUE');
    const corte = await request.put('/api/invoices/facturacion-al-dia').set(como(LIDER))
      .send({ projectId: A, alDiaHasta: '2000-01-01' });
    expect(corte.status).toBe(403);
    expect(corte.body.code).toBe('LLEVA_EQUIPO');
  });
});

describe('facturas: tarjetas y detalle por id, como la lista', () => {
  it('las tarjetas de arriba suman solo lo de su equipo', async () => {
    const r = await pedir(LIDER, `/api/invoices/stats?projectId=${A}`);
    expect(r.status).toBe(200);
    expect(Number(r.body.data.total_facturado)).toBe(21);
    const admin = await pedir(ADMIN, `/api/invoices/stats?projectId=${A}`);
    expect(Number(admin.body.data.total_facturado)).toBe(61);
  });

  it('la factura de otra gestora por id: 403 (ni ficha ni PDF); la de su equipo, sí', async () => {
    expect((await pedir(LIDER, `/api/invoices/${F2}`)).status).toBe(403);
    expect((await pedir(LIDER, `/api/invoices/${F2}/pdf`)).status).toBe(403);
    expect((await pedir(G1, `/api/invoices/${F2}`)).status).toBe(403);
    expect((await pedir(LIDER, `/api/invoices/${F1}`)).status).toBe(200);
    expect((await pedir(ADMIN, `/api/invoices/${F2}`)).status).toBe(200);
  });
});

describe('4 · WhatsApp', () => {
  it('la lista de personas: la líder, ella y su equipo; la admin sin equipo, todo el campus', async () => {
    const r = await pedir(LIDER, '/api/whatsapp/usuarios');
    expect(r.status).toBe(200);
    const vistas = r.body.data.map((u) => Number(u.id));
    expect(vistas).toEqual(expect.arrayContaining([LIDER.id, G1.id, G3.id]));
    expect(vistas).not.toContain(G2.id);
    expect(vistas).not.toContain(ADMIN.id);
    const admin = await pedir(ADMIN, '/api/whatsapp/usuarios');
    expect(admin.body.data.map((u) => Number(u.id))).toEqual(expect.arrayContaining([G1.id, G2.id, G3.id]));
  });

  it('entrar en la sesión de una gestora de fuera: 403 FUERA_DE_TU_EQUIPO', async () => {
    const req = (u, usuarioId) => ({ user: { userId: u.id, role: u.role }, query: { usuarioId: String(usuarioId) }, ip: '127.0.0.1' });
    await expect(usuarioObjetivo(req(LIDER, G2.id))).rejects.toMatchObject({ statusCode: 403, code: 'FUERA_DE_TU_EQUIPO' });
    // Por la ruta, lo mismo.
    const r = await request.get(`/api/whatsapp/chats?usuarioId=${G2.id}`).set(como(LIDER));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FUERA_DE_TU_EQUIPO');
    // A las de su equipo no se las corta por el equipo (lo que diga su WhatsApp, aparte).
    const dentro = await usuarioObjetivo(req(LIDER, G1.id)).catch((e) => e);
    expect(dentro?.code).not.toBe('FUERA_DE_TU_EQUIPO');
    // La admin sin equipo, como siempre: la de cualquiera de su campus.
    const admin = await usuarioObjetivo(req(ADMIN, G2.id)).catch((e) => e);
    expect(admin?.code).not.toBe('FUERA_DE_TU_EQUIPO');
  });
});

describe('5 · /auth/me dice el alcance', () => {
  it('la líder: su equipo y lleva_equipo; la admin sin equipo: null; la gestora: ella', async () => {
    const lider = (await pedir(LIDER, '/api/auth/me')).body.data.user;
    expect(lider.lleva_equipo).toBe(true);
    expect(lider.alcance_comercial.slice().sort()).toEqual([LIDER.id, G1.id, G3.id].sort());
    const admin = (await pedir(ADMIN, '/api/auth/me')).body.data.user;
    expect(admin).toMatchObject({ lleva_equipo: false, alcance_comercial: null });
    const g = (await pedir(G2, '/api/auth/me')).body.data.user;
    expect(g).toMatchObject({ lleva_equipo: false, alcance_comercial: [G2.id] });
  });
});

describe('6 · sin escalada', () => {
  it('la líder no se da «equipos.gestionar» por excepción, ni a sí misma ni a nadie', async () => {
    const aSiMisma = await request.put(`/api/permissions/personas/${LIDER.id}/excepciones`).set(como(LIDER))
      .send({ cambios: { 'equipos.gestionar': true } });
    expect(aSiMisma.status).toBe(403);
    const aOtra = await request.put(`/api/permissions/personas/${G1.id}/excepciones`).set(como(LIDER))
      .send({ cambios: { 'equipos.gestionar': true } });
    expect(aOtra.status).toBe(403);
    const porClave = await request.put(`/api/permissions/claves/equipos.gestionar/personas/${G1.id}`).set(como(LIDER))
      .send({ permitido: true });
    expect(porClave.status).toBeGreaterThanOrEqual(400);
    const quedan = await q(`SELECT 1 FROM user_permission_overrides
                             WHERE user_id = ANY($1::int[]) AND resource = 'equipos' AND action = 'gestionar'`,
    [[LIDER.id, G1.id]]);
    expect(quedan).toEqual([]);
  });

  it('ni se cambia el rol a soporte (que no tiene límite) con «Editar usuarios»', async () => {
    const r = await request.patch(`/api/users/${LIDER.id}`).set(como(LIDER)).send({ roles_extra: ['soporte'] });
    expect(r.status).toBe(403);
    const { roles_extra: extra } = await one('SELECT roles_extra::text[] AS roles_extra FROM users WHERE id = $1', [LIDER.id]);
    expect(extra || []).not.toContain('soporte');
  });

  it('ni cambia su propio equipo, aunque le den «equipos.gestionar»', async () => {
    const sin = await request.put(`/api/users/${LIDER.id}/equipo-comercial`).set(como(LIDER)).send({ gestoraIds: [G1.id, G2.id, G3.id] });
    expect(sin.status).toBe(403);
    // El super admin se lo da por excepción: aun así, su propio equipo, no.
    await q(`INSERT INTO user_permission_overrides (user_id, resource, action, allowed)
             VALUES ($1, 'equipos', 'gestionar', true)`, [LIDER.id]);
    const { olvidarPermisos } = await import('../src/modules/permissions/permissions.service.js');
    olvidarPermisos?.(LIDER.id);
    const con = await request.put(`/api/users/${LIDER.id}/equipo-comercial`).set(como(LIDER)).send({ gestoraIds: [G1.id, G2.id, G3.id] });
    expect(con.status).toBe(403);
    expect(con.body.code).toBe('EQUIPO_PROPIO');
    expect((await gestorasACargo(LIDER.id)).sort()).toEqual([G1.id, G3.id].sort());
    await q(`DELETE FROM user_permission_overrides WHERE user_id = $1 AND resource = 'equipos'`, [LIDER.id]);
    olvidarPermisos?.(LIDER.id);
  });
});

describe('otros sitios del barrido', () => {
  it('Informes › overview: el ranking por gestora, solo su equipo', async () => {
    const r = await pedir(LIDER, `/api/informes/overview?projectId=${A}`);
    expect(r.status).toBe(200);
    const nombres = r.body.data.leads_por_gestor.map((g) => g.gestor);
    expect(nombres).toContain(`${MARCA} g1`);
    expect(nombres).not.toContain(`${MARCA} g2`);
    const admin = await pedir(ADMIN, `/api/informes/overview?projectId=${A}`);
    expect(admin.body.data.leads_por_gestor.map((g) => g.gestor)).toContain(`${MARCA} g2`);
  });

  it('proceso y convocatorias de un prospecto de fuera, por id: 403', async () => {
    expect((await pedir(LIDER, `/api/proceso/lead/${L2}`)).status).toBe(403);
    expect((await pedir(LIDER, `/api/convocatorias/lead/${L2}`)).status).toBe(403);
    expect((await pedir(LIDER, `/api/proceso/lead/${L1}`)).status).not.toBe(403);
    expect((await pedir(ADMIN, `/api/proceso/lead/${L2}`)).status).not.toBe(403);
  });
});
