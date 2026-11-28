import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool, { getClient } from '../src/shared/config/db.js';
import * as conversionModel from '../src/modules/conversions/conversion.model.js';
import * as conversionService from '../src/modules/conversions/conversion.service.js';
import * as invoicesModel from '../src/modules/invoices/invoices.model.js';
import * as cobroFacturado from '../src/modules/conversions/cobro-facturado.js';

/**
 * CRM#1234 (gemela CRM-ISEIE#862) · Borrar una venta con facturas emitidas.
 *
 * `conversion_payments.conversion_id` es ON DELETE CASCADE y en `invoices`
 * `payment_id` y `conversion_id` son SET NULL: borrar la venta se llevaba sus
 * cobros y dejaba la factura emitida sin cobro y sin venta, sin pasar por la
 * regla de los cobros (`negarSiTieneFactura`, CRM#1230).
 *
 * Con facturas vigentes (no proformas, no canceladas, no anuladas a cero por
 * sus abonos) → 409 que dice qué facturas hay que anular antes. Tampoco con
 * comisiones ya pagadas: la del tutor (ON DELETE CASCADE desde el cobro) y la
 * de la gestora (ON DELETE CASCADE desde la venta) desaparecerían con ella.
 * Sin nada de eso, se borra como hoy.
 *
 *   npx vitest run tests/borrarVentaConFacturas1234.test.js
 */

const MARCA = `V1234${Date.now().toString(36)}`;
const SERIE = `V${Date.now().toString(36).slice(-6)}`;
const ANO = new Date().getFullYear();
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const one = async (sql, p) => (await q(sql, p))[0];
const existeVenta = async (id) => !!(await one('SELECT 1 FROM conversions WHERE id = $1', [id]));
const cobrosDe = async (id) => Number((await one('SELECT COUNT(*)::int AS n FROM conversion_payments WHERE conversion_id = $1', [id])).n);
const enlaceDe = (facturaId) => one('SELECT conversion_id, payment_id FROM invoices WHERE id = $1', [facturaId]);
const notasDeBorrado = async () => Number((await one(
  `SELECT COUNT(*)::int AS n FROM lead_interactions WHERE lead_id = $1 AND nota LIKE 'Compra eliminada%'`, [lead.id])).n);

let P; let GESTORA; let TUTOR; let lead; let EMISOR;
let numero = 0;

async function venta(importe_total = 300) {
  return conversionModel.create({
    lead_id: lead.id, project_id: P, producto_contratado: `${MARCA} curso`,
    importe_total, importe_pagado: 0, metodo_pago: 'transferencia', fecha_conversion: '2026-11-02',
    iva_incluido: true,
  });
}
const cobro = async (v, importe, fecha = '2026-11-03') => {
  const r = await conversionModel.addPayment(v.id, { importe, fecha, metodo: 'transferencia' }, { allowDuplicate: true });
  expect(r.error).toBeUndefined();
  return r.payment;
};
// Una factura emitida de la venta: de un cobro (`pago`) o por el total (sin cobro).
async function factura(v, pago, importe, { tipo = 'normal', estado = 'pagada' } = {}) {
  numero += 1;
  const serie = tipo === 'proforma' ? `P${SERIE.slice(1)}` : SERIE;
  return one(
    `INSERT INTO invoices (project_id, conversion_id, lead_id, payment_id, ano, serie, numero, codigo, tipo, estado,
                           fecha_emision, cliente_nombre, cliente_nif, cliente_direccion, cliente_ciudad, cliente_cp, cliente_pais,
                           items, base_imponible, iva_pct, iva_importe, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, $11, 'X1234567L',
             'Calle 1', 'Madrid', '28001', 'España', $12::jsonb, $13, 0, 0, $13) RETURNING id, codigo`,
    [P, v.id, lead.id, pago?.id ?? null, ANO, serie, numero, `${serie}-${ANO}/${String(numero).padStart(4, '0')}`,
     tipo, estado, `${MARCA} Cliente`, JSON.stringify([{ descripcion: 'Curso', cantidad: 1, precio_unitario: importe }]), importe]);
}
const anular = (id) => invoicesModel.anularEmitida(id, { motivo: 'Venta duplicada', userId: GESTORA.id });
const borrar = (v) => conversionService.remove(v.id, { reason: 'duplicada', userId: GESTORA.id });
const fallo = (p) => p.then(() => null, (e) => e);

beforeAll(async () => {
  EMISOR = (await one(
    `INSERT INTO invoice_issuers (razon_social, nif, serie, activo) VALUES ($1, 'B12345674', $2, true) RETURNING id`,
    [`${MARCA} S.L.`, `E${SERIE}`])).id;
  P = (await one(
    `INSERT INTO projects (nombre, slug, webhook_api_key, sociedad_emisora_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`${MARCA} campus`, MARCA.toLowerCase(), `${MARCA}-k`, EMISOR])).id;
  GESTORA = await one(
    `INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', 'gestor') RETURNING id`,
    [`${MARCA} gestora`, `gestora@${MARCA.toLowerCase()}.test`]);
  TUTOR = await one(
    `INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', 'gestor') RETURNING id`,
    [`${MARCA} tutor`, `tutor@${MARCA.toLowerCase()}.test`]);
  lead = await one(`INSERT INTO leads (nombre, project_id, responsable_id) VALUES ($1, $2, $3) RETURNING id`,
    [`${MARCA} alumno`, P, GESTORA.id]);
}, 60000);

afterAll(async () => {
  const ventas = `SELECT id FROM conversions WHERE project_id = ${Number(P)}`;
  for (const sql of [
    `DELETE FROM tutor_commissions WHERE tutor_id = ${Number(TUTOR?.id || 0)}`,
    `DELETE FROM commissions WHERE conversion_id IN (${ventas})`,
    `UPDATE invoices SET anulada_abono_id = NULL WHERE project_id = ${Number(P)}`,
    `DELETE FROM invoices WHERE project_id = ${Number(P)} AND rectifica_id IS NOT NULL`,
    `DELETE FROM invoices WHERE project_id = ${Number(P)}`,
    `DELETE FROM invoice_sequences WHERE project_id = ${Number(P)}`,
    `DELETE FROM conversion_installments WHERE conversion_id IN (${ventas})`,
    `DELETE FROM conversion_payments WHERE conversion_id IN (${ventas})`,
    `DELETE FROM conversion_items WHERE conversion_id IN (${ventas})`,
    `DELETE FROM conversions WHERE project_id = ${Number(P)}`,
    `DELETE FROM lead_interactions WHERE lead_id = ${Number(lead?.id || 0)}`,
    `DELETE FROM lead_status_history WHERE lead_id = ${Number(lead?.id || 0)}`,
    `DELETE FROM leads WHERE project_id = ${Number(P)}`,
    `DELETE FROM users WHERE id IN (${Number(GESTORA?.id || 0)}, ${Number(TUTOR?.id || 0)})`,
    `DELETE FROM projects WHERE id = ${Number(P)}`,
    `DELETE FROM invoice_sequences WHERE serie = 'E${SERIE}'`,
    `DELETE FROM invoice_issuers WHERE id = ${Number(EMISOR || 0)}`,
  ]) {
    try { await q(sql); } catch { /* sigue limpiando */ }
  }
  await pool.end();
}, 60000);

describe('#1234 · borrar una venta con facturas', () => {
  it('con la factura de un cobro vigente: 409 que la nombra, y la venta, el cobro y el enlace siguen', async () => {
    const v = await venta(300);
    const p = await cobro(v, 150);
    const f = await factura(v, p, 150);
    const antes = await notasDeBorrado();
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toContain(f.codigo);
    expect(err.message).toMatch(/anula/i);
    expect(await existeVenta(v.id)).toBe(true);
    expect(await cobrosDe(v.id)).toBe(1);
    expect(await enlaceDe(f.id)).toEqual({ conversion_id: v.id, payment_id: p.id });
    // Un 409 no deja la nota «Compra eliminada» en el historial del prospecto.
    expect(await notasDeBorrado()).toBe(antes);
  });

  it('con la factura por el total (sin cobro): 409 igual', async () => {
    const v = await venta(300);
    const f = await factura(v, null, 300);
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toContain(f.codigo);
    expect(await existeVenta(v.id)).toBe(true);
  });

  it('con dos facturas vigentes: el mensaje dice las dos', async () => {
    const v = await venta(300);
    const f1 = await factura(v, await cobro(v, 100, '2026-11-03'), 100);
    const f2 = await factura(v, await cobro(v, 100, '2026-11-04'), 100);
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toContain(f1.codigo);
    expect(err.message).toContain(f2.codigo);
  });

  it('la regla está también en el modelo: deleteConversion directo da 409', async () => {
    const v = await venta(300);
    await factura(v, await cobro(v, 120), 120);
    await expect(conversionModel.deleteConversion(v.id)).rejects.toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(await existeVenta(v.id)).toBe(true);
  });

  it('con el borrado abierto, una factura nueva de la venta espera (no se cuela entre la regla y el DELETE)', async () => {
    const v = await venta(300);
    const p = await cobro(v, 80);
    const borrado = await getClient();
    const otra = await getClient();
    try {
      await borrado.query('BEGIN');
      await cobroFacturado.negarSiLaVentaNoSeBorra(borrado, v.id, { bloquear: true });
      await otra.query('BEGIN');
      await otra.query("SET LOCAL lock_timeout = '300ms'");
      numero += 1;
      const err = await otra.query(
        `INSERT INTO invoices (project_id, conversion_id, payment_id, ano, serie, numero, codigo, tipo, estado, fecha_emision,
                               cliente_nombre, cliente_nif, cliente_direccion, cliente_ciudad, cliente_cp, cliente_pais,
                               items, base_imponible, iva_pct, iva_importe, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'normal', 'pagada', CURRENT_DATE, 'x', 'X1234567L',
                 'Calle 1', 'Madrid', '28001', 'España', '[]'::jsonb, 80, 0, 0, 80)`,
        [P, v.id, p.id, ANO, SERIE, numero, `${SERIE}-${ANO}/${String(numero).padStart(4, '0')}`]).then(() => null, (e) => e);
      expect(err?.code).toBe('55P03');
    } finally {
      await otra.query('ROLLBACK').catch(() => {});
      await borrado.query('ROLLBACK').catch(() => {});
      otra.release();
      borrado.release();
    }
  });

  it('con una factura en borrador: 409 que pide cancelarla, no anularla', async () => {
    const v = await venta(300);
    const f = await factura(v, await cobro(v, 70), 70);
    await q(`UPDATE invoices SET estado = 'borrador', numero = NULL, codigo = NULL WHERE id = $1`, [f.id]);
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toMatch(/borrador/);
    expect(err.message).toMatch(/cancel/i);
    expect(await existeVenta(v.id)).toBe(true);
  });

  it('con un abono parcial: sigue vigente (409, «anular»); tras «Anular», se borra', async () => {
    const v = await venta(300);
    const f = await factura(v, await cobro(v, 100), 100);
    await invoicesModel.createRectificativa(f.id, { motivo: 'Descuento', userId: GESTORA.id, parcial: 40 });
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toContain(`anular la factura ${f.codigo}`);
    await anular(f.id);
    await borrar(v);
    expect(await existeVenta(v.id)).toBe(false);
  });

  it('anulada sin un abono que la deje a cero: 409 con lo que queda', async () => {
    const v = await venta(300);
    const f = await factura(v, await cobro(v, 90), 90);
    await q(`UPDATE invoices SET anulada_at = NOW(), motivo_anulacion = 'a mano' WHERE id = $1`, [f.id]);
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
    expect(err.message).toContain(`emitir el abono que falta de ${f.codigo} (quedan 90.00 €)`);
    expect(await existeVenta(v.id)).toBe(true);
  });

  it('con la factura anulada a cero: se borra, y la factura y su abono se quedan como documentos', async () => {
    const v = await venta(300);
    const p = await cobro(v, 90);
    const f = await factura(v, p, 90);
    const { abono } = await anular(f.id);
    await borrar(v);
    expect(await existeVenta(v.id)).toBe(false);
    const doc = await one('SELECT codigo, anulada_at IS NOT NULL AS anulada, total::float8 AS total FROM invoices WHERE id = $1', [f.id]);
    expect(doc).toEqual({ codigo: f.codigo, anulada: true, total: 90 });
    expect(await one('SELECT id FROM invoices WHERE id = $1', [abono.id])).toBeTruthy();
  });

  it('con solo proforma o factura cancelada: se borra como hoy', async () => {
    const v = await venta(300);
    const p = await cobro(v, 60);
    await factura(v, p, 60, { tipo: 'proforma', estado: 'emitida' });
    await factura(v, null, 300, { estado: 'cancelada' });
    await borrar(v);
    expect(await existeVenta(v.id)).toBe(false);
    expect(await cobrosDe(v.id)).toBe(0);
  });

  it('sin facturas: se borra como hoy, con sus cobros y la nota en el historial', async () => {
    const v = await venta(300);
    await cobro(v, 50);
    const antes = await notasDeBorrado();
    const r = await borrar(v);
    expect(r).toMatchObject({ message: 'Conversion eliminada', reason: 'duplicada' });
    expect(await existeVenta(v.id)).toBe(false);
    expect(await cobrosDe(v.id)).toBe(0);
    expect(await notasDeBorrado()).toBe(antes + 1);
  });
});

describe('#1234 · borrar una venta con comisiones ya pagadas', () => {
  const comisionTutor = (pago, estado) => one(
    `INSERT INTO tutor_commissions (payment_id, tutor_id, base_calculo, pct, importe, estado, periodo)
     VALUES ($1, $2, 100, 10, 10, $3, '2026-11') RETURNING id`, [pago.id, TUTOR.id, estado]);
  const comisionGestora = (v, estado) => one(
    `INSERT INTO commissions (conversion_id, user_id, importe_base, pct, importe_comision, estado, fecha_pago)
     VALUES ($1, $2, 100, 10, 10, $3::varchar, CASE WHEN $3::varchar = 'pagado' THEN DATE '2026-11-20' END) RETURNING id`,
    [v.id, GESTORA.id, estado]);

  it('comisión de tutor pagada: 409 y la comisión sigue', async () => {
    const v = await venta(300);
    const p = await cobro(v, 100);
    const tc = await comisionTutor(p, 'pagada');
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_PAID_COMMISSION' });
    expect(err.message).toMatch(/tutor/);
    expect(await existeVenta(v.id)).toBe(true);
    expect(await one('SELECT estado FROM tutor_commissions WHERE id = $1', [tc.id])).toEqual({ estado: 'pagada' });
  });

  it('comisión de tutor pendiente: se borra como hoy', async () => {
    const v = await venta(300);
    await comisionTutor(await cobro(v, 100), 'pendiente');
    await borrar(v);
    expect(await existeVenta(v.id)).toBe(false);
  });

  it('comisión de la gestora pagada: 409 con el importe, y la comisión sigue', async () => {
    const v = await venta(300);
    await cobro(v, 100);
    const c = await comisionGestora(v, 'pagado');
    const err = await fallo(borrar(v));
    expect(err).toMatchObject({ statusCode: 409, code: 'SALE_HAS_PAID_COMMISSION' });
    expect(err.message).toMatch(/gestora/);
    expect(err.message).toMatch(/10\.00/);
    expect(await existeVenta(v.id)).toBe(true);
    expect(await one('SELECT estado FROM commissions WHERE id = $1', [c.id])).toEqual({ estado: 'pagado' });
  });

  it('comisión de la gestora pendiente: se borra como hoy', async () => {
    const v = await venta(300);
    await cobro(v, 100);
    await comisionGestora(v, 'pendiente');
    await borrar(v);
    expect(await existeVenta(v.id)).toBe(false);
  });

  it('factura vigente y comisión pagada: manda la factura (es lo primero que hay que hacer)', async () => {
    const v = await venta(300);
    const p = await cobro(v, 100);
    await factura(v, p, 100);
    await comisionTutor(p, 'pagada');
    await expect(borrar(v)).rejects.toMatchObject({ statusCode: 409, code: 'SALE_HAS_INVOICE' });
  });
});
