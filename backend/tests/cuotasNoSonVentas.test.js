import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app.js';
import pool from '../src/shared/config/db.js';
import { CLASE_FACTURA } from '../src/modules/invoices/clase.sql.js';

/**
 * Una cuota registrada como ficha aparte no es una venta nueva (#100, punto 1).
 *
 * EL TICKET DABA POR HECHO ALGO QUE NO ERA VERDAD: «el backend ya sabe
 * distinguirlas, así que es sobre todo pintarlo». La columna `es_mensualidad`
 * estaba desde el principio y una veintena de consultas la filtran —el
 * ranking, el recuento de ventas, las plazas, los informes—, pero NADIE PODÍA
 * MARCARLA: no había casilla, ni campo en ningún esquema, ni línea en ningún
 * INSERT. Estaba a false en las 491 fichas, así que todos esos filtros no
 * filtraban nada y no había nada que pintar.
 *
 * Por qué no se puede deducir de los datos, que es lo que se intentó primero:
 * la regla del primer cobro —`ES_MATRICULA`— distingue bien cuando la cuota se
 * apunta como un cobro más de la venta original. Pero si se registra como
 * FICHA NUEVA, su único cobro es el primero de esa ficha, así que la regla la
 * llama matrícula. Es indistinguible de una venta al contado mirando la base;
 * solo lo sabe quien la está creando.
 *
 * Lo que se fija aquí, contra Postgres de verdad y no contra un mock, porque
 * lo que falla en estas cosas es el SQL:
 *
 *   - que la marca SE GUARDE por las dos puertas por las que se crea una ficha;
 *   - que el ranking de programas no la cuente;
 *   - que la lista la enseñe como cuota y no como venta;
 *   - que Facturación diga lo mismo que Ventas — el motivo entero de que
 *     `CLASE_FACTURA` viva en un solo fichero.
 */

const request = supertest(app);
let token;
let leadId;
let productoId;
/** Un producto solo para el ranking: los demas tests dejan fichas del otro y
 *  el recuento dejaria de ser comprobable. */
let productoRankingId;
const PROYECTO = 1;
const creadas = [];
const facturas = [];
/** Fecha fija y vieja: así no se cruza con lo que haya en el periodo actual. */
const FECHA = '2026-03-11';

async function crearFicha({ esCuota, importe, producto = 'Curso Cuota Test', productoRef = null }) {
  const res = await request.post('/api/conversions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      lead_id: leadId,
      project_id: PROYECTO,
      producto_contratado: producto,
      producto_contratado_id: productoRef ?? productoId,
      importe_total: importe,
      importe_pagado: importe,
      metodo_pago: 'transferencia',
      fecha_conversion: FECHA,
      es_mensualidad: esCuota,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  creadas.push(res.body.data.id);
  return res.body.data;
}

beforeAll(async () => {
  const login = await request.post('/api/auth/login')
    .send({ email: 'diego@empresa.com', password: 'CrmTemp2026!' });
  token = login.body.data.accessToken;

  const { rows: pr } = await pool.query(
    `INSERT INTO products (project_id, nombre, precio, active)
     VALUES ($1, 'Curso Cuota Test', 300, TRUE) RETURNING id`, [PROYECTO]);
  productoId = pr[0].id;
  const { rows: pr2 } = await pool.query(
    `INSERT INTO products (project_id, nombre, precio, active)
     VALUES ($1, 'Curso Cuota Ranking', 300, TRUE) RETURNING id`, [PROYECTO]);
  productoRankingId = pr2[0].id;

  const { rows } = await pool.query(
    // `fecha_solicitud` ADEMAS de `created_at`: el CRM no deja vender antes
    // de que el prospecto entre, y mira la primera de las dos.
    `INSERT INTO leads (project_id, nombre, email, status, responsable_id, created_at, fecha_solicitud)
     VALUES ($1, 'Cuota Test Lead', 'cuota-test@test-cuota.com', 'en_seguimiento', 2, $2, $2)
     RETURNING id`, [PROYECTO, '2026-03-01 09:00:00']);
  leadId = rows[0].id;
});

afterAll(async () => {
  for (const id of facturas) await pool.query('DELETE FROM invoices WHERE id = $1', [id]);
  for (const id of creadas) {
    await pool.query('DELETE FROM conversion_payments WHERE conversion_id = $1', [id]);
    await pool.query('DELETE FROM conversion_items WHERE conversion_id = $1', [id]);
    await pool.query('DELETE FROM conversions WHERE id = $1', [id]);
  }
  await pool.query('DELETE FROM lead_status_history WHERE lead_id = $1', [leadId]);
  await pool.query('DELETE FROM leads WHERE id = $1', [leadId]);
  await pool.query('DELETE FROM products WHERE id = ANY($1::int[])', [[productoId, productoRankingId]]);
  await pool.end();
});

describe('marcar una ficha como cuota', () => {
  it('se guarda — antes se perdía por el camino', async () => {
    // El campo no estaba en el esquema de Zod, así que `.parse()` lo tiraba
    // antes de llegar al modelo: se mandaba y no pasaba nada.
    const ficha = await crearFicha({ esCuota: true, importe: 150 });
    const { rows } = await pool.query('SELECT es_mensualidad FROM conversions WHERE id = $1', [ficha.id]);
    expect(rows[0].es_mensualidad).toBe(true);
  });

  it('sin decir nada, es una venta', async () => {
    // Que el valor por defecto sea «venta» importa: al revés, cualquier alta
    // hecha desde una integración dejaría de contarse sin que nadie lo note.
    const ficha = await crearFicha({ esCuota: undefined, importe: 500 });
    const { rows } = await pool.query('SELECT es_mensualidad FROM conversions WHERE id = $1', [ficha.id]);
    expect(rows[0].es_mensualidad).toBe(false);
  });

  it('también por POST /api/ventas, que es la puerta de la pantalla', async () => {
    const res = await request.post('/api/ventas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_id: PROYECTO,
        lead_id: leadId,
        producto_interes_id: productoId,
        importe_total: 150,
        importe_pagado: 150,
        metodo_pago: 'transferencia',
        fecha_pago: FECHA,
        es_mensualidad: true,
      });
    expect(res.status).toBe(201);
    const id = res.body.data.conversion_id || res.body.data.sale_id;
    creadas.push(id);
    const { rows } = await pool.query('SELECT es_mensualidad FROM conversions WHERE id = $1', [id]);
    expect(rows[0].es_mensualidad).toBe(true);
  });

  it('una mal clasificada se arregla editándola, sin borrarla', async () => {
    // Borrar y rehacer es como se pierden los cobros y las facturas que ya
    // colgaban de la ficha.
    const ficha = await crearFicha({ esCuota: false, importe: 120 });
    const res = await request.patch(`/api/conversions/${ficha.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ es_mensualidad: true });
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT es_mensualidad FROM conversions WHERE id = $1', [ficha.id]);
    expect(rows[0].es_mensualidad).toBe(true);
  });
});

describe('lo que cambia cuando está marcada', () => {
  it('el ranking de programas no la cuenta', async () => {
    const P = { producto: 'Curso Cuota Ranking', productoRef: productoRankingId };
    const venta = await crearFicha({ esCuota: false, importe: 300, ...P });
    const cuota = await crearFicha({ esCuota: true, importe: 50, ...P });

    const res = await request.get('/api/ventas/top-products')
      .set('Authorization', `Bearer ${token}`)
      .query({ projectId: PROYECTO, from: FECHA, to: FECHA, limit: 50 });
    expect(res.status).toBe(200);

    // `data` ES la lista: lo que no es un programa va aparte, en `sinAsignar`.
    const fila = (res.body.data || []).find((p) => p.producto === 'Curso Cuota Ranking');
    expect(fila).toBeTruthy();
    // Dos fichas del mismo curso el mismo día, pero UNA sola venta: la otra es
    // la cuota. Sin la marca, el curso subía un puesto cada mes cobrando lo
    // mismo, y el importe sumaba la cuota encima de un precio ya contado.
    expect(Number(fila.ventas)).toBe(1);
    expect(Number(fila.facturado)).toBe(300);

    expect(venta.id).toBeTruthy();
    expect(cuota.id).toBeTruthy();
  });

  it('la lista la enseña como cuota, no como venta', async () => {
    const cuota = await crearFicha({ esCuota: true, importe: 75 });
    const res = await request.get('/api/conversions/filas')
      .set('Authorization', `Bearer ${token}`)
      .query({ projectId: PROYECTO, from: FECHA, to: FECHA, limit: 200 });
    expect(res.status).toBe(200);
    const fila = (res.body.data || []).find((f) => f.venta_id === cuota.id && f.factura_id === null);
    expect(fila).toBeTruthy();
    expect(fila.tipo).toBe('cuota');
  });

  it('Facturación la clasifica igual que Ventas', async () => {
    // `CLASE_FACTURA` existe para que las dos pantallas lean la misma regla.
    // Si aquí dijera «venta», Facturación contaría una venta nueva que Ventas
    // ya no cuenta, que es justo de donde venía el ticket.
    const cuota = await crearFicha({ esCuota: true, importe: 90 });
    const { rows: pago } = await pool.query(
      'SELECT id FROM conversion_payments WHERE conversion_id = $1 ORDER BY id LIMIT 1', [cuota.id]);
    const { rows: inv } = await pool.query(
      `INSERT INTO invoices (project_id, conversion_id, payment_id, ano, numero, codigo, tipo, estado,
                             cliente_nombre, cliente_nif, cliente_direccion, cliente_ciudad,
                             cliente_cp, cliente_pais, items, fecha_emision, base_imponible, iva_importe, total)
       VALUES ($1, $2, $3, 2026, 990001, 'TEST-CUOTA-1', 'normal', 'pagada', 'Cuota Test Lead', 'X0000000X', 'Calle Test 1', 'Madrid',
               '28001', 'ES', '[]'::jsonb, $4, 74.38, 15.62, 90)
       RETURNING id`,
      [PROYECTO, cuota.id, pago[0].id, FECHA]);
    facturas.push(inv[0].id);

    const { rows } = await pool.query(
      `SELECT (${CLASE_FACTURA}) AS clase FROM invoices i WHERE i.id = $1`, [inv[0].id]);
    expect(rows[0].clase).toBe('cuota');
  });

  it('y sin la marca, esa misma factura sería una venta', async () => {
    // El contraste importa: prueba que lo que decide es la marca y no otra
    // cosa del montaje —el importe, la fecha, que sea el primer cobro—.
    const venta = await crearFicha({ esCuota: false, importe: 90 });
    const { rows: pago } = await pool.query(
      'SELECT id FROM conversion_payments WHERE conversion_id = $1 ORDER BY id LIMIT 1', [venta.id]);
    const { rows: inv } = await pool.query(
      `INSERT INTO invoices (project_id, conversion_id, payment_id, ano, numero, codigo, tipo, estado,
                             cliente_nombre, cliente_nif, cliente_direccion, cliente_ciudad,
                             cliente_cp, cliente_pais, items, fecha_emision, base_imponible, iva_importe, total)
       VALUES ($1, $2, $3, 2026, 990002, 'TEST-CUOTA-2', 'normal', 'pagada', 'Cuota Test Lead', 'X0000000X', 'Calle Test 1', 'Madrid',
               '28001', 'ES', '[]'::jsonb, $4, 74.38, 15.62, 90)
       RETURNING id`,
      [PROYECTO, venta.id, pago[0].id, FECHA]);
    facturas.push(inv[0].id);

    const { rows } = await pool.query(
      `SELECT (${CLASE_FACTURA}) AS clase FROM invoices i WHERE i.id = $1`, [inv[0].id]);
    expect(rows[0].clase).toBe('venta');
  });
});

describe('y una que salio al verificar lo anterior', () => {
  it('el producto que se guarda es el del catálogo, no el nombre del cliente', async () => {
    // `createSale` manda el NOMBRE DEL CLIENTE como `producto_contratado`
    // contando con que el servicio lo corrija con el lookup. Pero ese lookup
    // solo va de texto a id, y cuando el id ya viene puesto no corre: el texto
    // se quedaba. En la lista de Ventas se veía «Pedro Sanchez» en la columna
    // de programa, en todas las ventas hechas desde el formulario.
    const res = await request.post('/api/ventas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_id: PROYECTO,
        lead_id: leadId,
        producto_interes_id: productoRankingId,
        importe_total: 60,
        importe_pagado: 60,
        metodo_pago: 'transferencia',
        fecha_pago: FECHA,
      });
    expect(res.status).toBe(201);
    const id = res.body.data.conversion_id;
    creadas.push(id);
    const { rows } = await pool.query(
      'SELECT producto_contratado, producto_contratado_id FROM conversions WHERE id = $1', [id]);
    expect(rows[0].producto_contratado).toBe('Curso Cuota Ranking');
    expect(rows[0].producto_contratado_id).toBe(productoRankingId);
  });
});
