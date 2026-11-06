import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * El mismo cargo de Stripe queda UNA vez en la venta (#680, #635), contra la base de verdad.
 *
 * Llega por varios caminos: el aviso de Stripe, el sondeo de cada 5 minutos y el botón
 * «Sincronizar». Si llegaban a la vez, todos veían la venta aún sin el cobro, todos pasaban
 * la comprobación de duplicados antes de que otro escribiera y todos lo sumaban. El 06/11, en
 * local y sin el arreglo, diez avisos a la vez dejaron el MISMO cobro diez veces en la venta.
 *
 * Va en su propio archivo, sin cargar la app entera: con ella los tiempos cambian y la
 * carrera deja de reproducirse sin el arreglo (la prueba no defendería nada).
 *
 *   npx vitest run tests/stripeCobroUnaVez680.test.js
 */

const { query } = await import('../src/shared/config/db.js');
const servicio = await import('../src/modules/stripe-payments/stripe-payments.service.js');

const MARCA = `SU680${Date.now().toString(36)}`;
const CORREO = `alumna.${MARCA.toLowerCase()}@prueba.test`;
const ids = { project: null, lead: null, conversion: null };

const evento = (id, euros) => ({
  type: 'charge.succeeded',
  data: { object: { id, amount: euros * 100, currency: 'eur', status: 'succeeded',
    created: Math.floor(Date.now() / 1000), billing_details: { email: CORREO } } },
});
const cobros = (id) => query('SELECT id FROM conversion_payments WHERE conversion_id = $1 AND notas LIKE $2',
  [ids.conversion, `%${id}%`]).then((r) => r.rows);

beforeAll(async () => {
  ids.project = (await query(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
    [`${MARCA} Campus`, MARCA.toLowerCase(), `${MARCA}-key`])).rows[0].id;
  ids.lead = (await query(`INSERT INTO leads (project_id, nombre, email, status) VALUES ($1, $2, $3, 'convertido') RETURNING id`,
    [ids.project, `${MARCA} Alumna`, CORREO])).rows[0].id;
  ids.conversion = (await query(
    `INSERT INTO conversions (lead_id, project_id, producto_contratado, importe_total, importe_pagado, fecha_conversion)
     VALUES ($1, $2, 'Máster', 5000, 0, CURRENT_DATE) RETURNING id`, [ids.lead, ids.project])).rows[0].id;
}, 60000);

afterAll(async () => {
  for (const [sql, v] of [
    ['DELETE FROM conversion_payments WHERE conversion_id = $1', ids.conversion],
    ['DELETE FROM stripe_payments WHERE project_id = $1', ids.project],
    ['DELETE FROM conversions WHERE id = $1', ids.conversion],
    ['DELETE FROM leads WHERE id = $1', ids.lead],
    ['DELETE FROM projects WHERE id = $1', ids.project],
  ]) {
    try { await query(sql, [v]); } catch { /* sigue limpiando */ }
  }
});

describe('#680 / #635 · el mismo cargo por varios caminos a la vez', () => {
  it('diez a la vez dejan UN cobro en la venta, y el cargo apunta a ese cobro', async () => {
    const id = `ch_${MARCA}_a`;
    await Promise.all(Array.from({ length: 10 }, () => servicio.handleWebhookEvent(ids.project, evento(id, 100))));
    const lista = await cobros(id);
    expect(lista).toHaveLength(1);
    const { rows: [sp] } = await query(
      'SELECT conversion_id, conversion_payment_id FROM stripe_payments WHERE project_id = $1 AND stripe_id = $2', [ids.project, id]);
    expect(sp.conversion_id).toBe(ids.conversion);
    expect(sp.conversion_payment_id).toBe(lista[0].id);
  });

  it('otro cargo distinto también entra una sola vez, aunque llegue en ráfaga', async () => {
    const id = `ch_${MARCA}_b`;
    await Promise.all(Array.from({ length: 10 }, () => servicio.handleWebhookEvent(ids.project, evento(id, 250))));
    expect(await cobros(id)).toHaveLength(1);
  });

  it('y si vuelve a llegar más tarde (el sondeo, un reintento de Stripe), no suma otra vez', async () => {
    const id = `ch_${MARCA}_a`;
    await servicio.handleWebhookEvent(ids.project, evento(id, 100));
    expect(await cobros(id)).toHaveLength(1);
  });
});
