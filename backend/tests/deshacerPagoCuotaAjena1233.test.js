import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * «Deshacer el pago» de una cuota ajena (CRM#1233).
 *
 * La sospecha: `unpayInstallment` solo pide `puede('conversions.cobros')`, y una
 * gestora con ese permiso podría hacer `POST /installments/<cuota de otra>/unpay`
 * y borrar el cobro de una venta que no es suya. No pasa: `router.param('instId',
 * cuotaPorId)` saca la venta desde la cuota y le aplica el alcance de la gestora
 * (conversion.acceso.js) antes de llegar al controlador. Esta prueba lo deja
 * fijado, también para «editar el pago» (`PATCH /installments/:instId/paid`),
 * que es la misma ruta hermana.
 *
 * Lo que defiende: lo ajeno NO se toca (ni el cobro, ni la cuota, ni lo cobrado
 * de la venta) y la respuesta no es un éxito. Y que la dueña sí puede, para que
 * el «no» no venga de que a la gestora le falte el permiso.
 *
 *   npx vitest run tests/deshacerPagoCuotaAjena1233.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { default: modulo } = await import('../src/modules/conversions/index.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use(modulo.prefix, modulo.router);
app.use(errorHandler);
const request = supertest(app);

const MARCA = `DPA${Date.now().toString(36)}`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [], leads: [], conversions: [] };
let P; let OTRO;
let DUENA; let COMPANERA; let GESTORA_OTRO;
let VENTA; let CUOTA;

const como = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' })}` });

async function persona(n, role, campus = []) {
  const [u] = await q(
    `INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role`,
    [`${MARCA} ${n}`, `${n.toLowerCase()}@${MARCA.toLowerCase()}.test`, role]);
  ids.users.push(u.id);
  for (const c of campus) await q(`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`, [u.id, c]);
  return u;
}

/** La cuota, cobrada: su pago en `conversion_payments` y la venta con 100 cobrados. */
async function cuotaCobrada() {
  await q(`DELETE FROM conversion_payments WHERE conversion_id = $1`, [VENTA]);
  const [{ id: pago }] = await q(
    `INSERT INTO conversion_payments (conversion_id, importe, fecha) VALUES ($1, 100, CURRENT_DATE) RETURNING id`, [VENTA]);
  await q(
    `UPDATE conversion_installments
        SET fecha_cobro = CURRENT_DATE, importe_cobrado = 100, metodo = 'transferencia', payment_id = $2
      WHERE id = $1`, [CUOTA, pago]);
  await q(`UPDATE conversions SET importe_pagado = 100 WHERE id = $1`, [VENTA]);
  return pago;
}

async function estado(pago) {
  const [c] = await q(`SELECT fecha_cobro, importe_cobrado, payment_id FROM conversion_installments WHERE id = $1`, [CUOTA]);
  const [v] = await q(`SELECT importe_pagado FROM conversions WHERE id = $1`, [VENTA]);
  const pagos = await q(`SELECT 1 FROM conversion_payments WHERE id = $1`, [pago]);
  return { cobrada: c.fecha_cobro !== null, importe: Number(c.importe_cobrado), pago: c.payment_id, cobrado: Number(v.importe_pagado), pagoExiste: pagos.length === 1 };
}

beforeAll(async () => {
  const proy = async (c) => {
    const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} ${c}`, `${MARCA.toLowerCase()}-${c}`, `${MARCA}-key-${c}`]);
    ids.projects.push(p.id);
    return p.id;
  };
  P = await proy('a'); OTRO = await proy('b');
  DUENA = await persona('DUENA', 'gestor', [P]);
  COMPANERA = await persona('COMPANERA', 'gestor', [P]);
  GESTORA_OTRO = await persona('GESTORAOTRO', 'gestor', [OTRO]);

  const [l] = await q(`INSERT INTO leads (project_id, nombre, email, telefono, responsable_id) VALUES ($1, $2, $3, '+34600111333', $4) RETURNING id`,
    [P, `${MARCA} Ana`, `ana@lead.${MARCA.toLowerCase()}.test`, DUENA.id]);
  ids.leads.push(l.id);
  const [v] = await q(
    `INSERT INTO conversions (lead_id, project_id, producto_contratado, importe_total, importe_pagado, fecha_conversion, vendedora_id)
     VALUES ($1, $2, 'x', 500, 0, CURRENT_DATE, $3) RETURNING id`,
    [l.id, P, DUENA.id]);
  VENTA = v.id; ids.conversions.push(v.id);
  [{ id: CUOTA }] = await q(`INSERT INTO conversion_installments (conversion_id, numero, importe_previsto, fecha_vencimiento) VALUES ($1, 1, 100, CURRENT_DATE) RETURNING id`, [VENTA]);
}, 60000);

afterAll(async () => {
  await q(`DELETE FROM conversion_installments WHERE conversion_id = ANY($1::int[])`, [ids.conversions]);
  await q(`DELETE FROM conversion_payments WHERE conversion_id = ANY($1::int[])`, [ids.conversions]);
  await q(`DELETE FROM conversions WHERE id = ANY($1::int[])`, [ids.conversions]);
  await q(`DELETE FROM leads WHERE id = ANY($1::int[])`, [ids.leads]);
  await q(`DELETE FROM user_projects WHERE user_id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids.projects]);
  await pool.end();
}, 60000);

let PAGO;
beforeEach(async () => { PAGO = await cuotaCobrada(); });

describe('deshacer o editar el pago de una cuota ajena (CRM#1233)', () => {
  it.each([
    ['una gestora del mismo campus que no es la suya', () => COMPANERA],
    ['una gestora de otro campus', () => GESTORA_OTRO],
  ])('%s no deshace el pago: no es un éxito y el cobro sigue ahí', async (_n, quien) => {
    const antes = await estado(PAGO);
    const r = await request.post(`/api/conversions/installments/${CUOTA}/unpay`).set(como(quien()));
    expect([403, 404]).toContain(r.status);
    expect(r.body.success).toBe(false);
    expect(await estado(PAGO)).toEqual(antes);
    expect(antes).toMatchObject({ cobrada: true, pagoExiste: true, cobrado: 100 });
  });

  it.each([
    ['una gestora del mismo campus que no es la suya', () => COMPANERA],
    ['una gestora de otro campus', () => GESTORA_OTRO],
  ])('%s tampoco edita el pago hecho', async (_n, quien) => {
    const antes = await estado(PAGO);
    const r = await request.patch(`/api/conversions/installments/${CUOTA}/paid`).set(como(quien())).send({ importe_cobrado: 1 });
    expect([403, 404]).toContain(r.status);
    expect(await estado(PAGO)).toEqual(antes);
  });

  it('la gestora dueña sí lo deshace (el «no» de arriba no es por falta de permiso)', async () => {
    const r = await request.post(`/api/conversions/installments/${CUOTA}/unpay`).set(como(DUENA));
    expect(r.status).toBe(200);
    expect(await estado(PAGO)).toMatchObject({ cobrada: false, pago: null, pagoExiste: false, cobrado: 0 });
  });
});
