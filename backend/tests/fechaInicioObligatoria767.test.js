import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app.js';
import pool from '../src/shared/config/db.js';
import { createConversionSchema, updateConversionSchema, FALTA_FECHA_INICIO } from '../src/modules/conversions/conversion.validation.js';
import { createSaleSchema } from '../src/modules/sales/sales.validation.js';

/**
 * La fecha de inicio del curso, obligatoria al cerrar la venta (#767, paso 1).
 *
 * Con ella se programa la matrícula en Moodle (el día anterior). Las dos rutas
 * del formulario la exigen: POST /api/conversions («Nueva venta» de la ficha)
 * y POST /api/ventas («Registrar venta»). Los caminos sin nadie delante
 * (Conciliación usa el mismo esquema de /ventas; compra directa y links de
 * pago llaman al servicio) siguen sin ella.
 */

const request = supertest(app);
const PROYECTO = 1;
let token;
let leadId;
let productoId;
const ventas = [];

const base = (extra = {}) => ({
  lead_id: 1, project_id: 1, producto_contratado: 'Curso', importe_total: 100, importe_pagado: 0, ...extra,
});

describe('esquemas (sin base)', () => {
  it('«Nueva venta» sin fecha de inicio no pasa, y el mensaje dice qué falta', () => {
    const r = createConversionSchema.safeParse(base());
    expect(r.success).toBe(false);
    expect(r.error.errors[0].message).toBe(FALTA_FECHA_INICIO);
    expect(createConversionSchema.safeParse(base({ fecha_inicio: null })).success).toBe(false);
    expect(createConversionSchema.safeParse(base({ fecha_inicio: '' })).success).toBe(false);
  });

  it('una fecha pasada vale (cursos ya empezados); una que no existe, no', () => {
    expect(createConversionSchema.safeParse(base({ fecha_inicio: '2020-01-15' })).success).toBe(true);
    expect(createConversionSchema.safeParse(base({ fecha_inicio: '2030-09-01' })).success).toBe(true);
    const mala = createConversionSchema.safeParse(base({ fecha_inicio: '2026-02-31' }));
    expect(mala.success).toBe(false);
    expect(mala.error.errors[0].message).toBe('esa fecha no existe');
  });

  it('editar: se puede poner, cambiar o quitar', () => {
    expect(updateConversionSchema.safeParse({ fecha_inicio: '2026-12-01' }).success).toBe(true);
    expect(updateConversionSchema.safeParse({ fecha_inicio: null }).success).toBe(true);
    expect(updateConversionSchema.safeParse({ fecha_inicio: '2026-13-01' }).success).toBe(false);
  });

  it('el esquema de /ventas la deja opcional: Conciliación lo usa sin ella', () => {
    const venta = { project_id: 1, lead_id: 5, producto_interes_id: 3, importe_total: 100, fecha_pago: '2026-11-20' };
    expect(createSaleSchema.safeParse(venta).success).toBe(true);
    expect(createSaleSchema.safeParse({ ...venta, fecha_inicio: '2026-12-01' }).success).toBe(true);
    expect(createSaleSchema.safeParse({ ...venta, fecha_inicio: '01/12/2026' }).success).toBe(false);
  });
});

describe('las rutas del formulario (con la base local)', () => {
  beforeAll(async () => {
    const login = await request.post('/api/auth/login')
      .send({ email: 'diego@empresa.com', password: 'CrmTemp2026!' });
    token = login.body.data.accessToken;
    const { rows: pr } = await pool.query(
      `INSERT INTO products (project_id, nombre, precio, active) VALUES ($1, 'Curso Fecha Inicio 767', 300, TRUE) RETURNING id`, [PROYECTO]);
    productoId = pr[0].id;
    const { rows } = await pool.query(
      `INSERT INTO leads (project_id, nombre, email, status, responsable_id, created_at, fecha_solicitud)
       VALUES ($1, 'Alumna Fecha Inicio 767', 'fecha-inicio-767@test-767.com', 'en_seguimiento', 2, $2, $2) RETURNING id`,
      [PROYECTO, '2026-01-01 09:00:00']);
    leadId = rows[0].id;
  });

  afterAll(async () => {
    for (const id of ventas) {
      await pool.query('DELETE FROM matriculas_moodle WHERE conversion_id = $1', [id]).catch(() => {});
      await pool.query('DELETE FROM conversion_payments WHERE conversion_id = $1', [id]);
      await pool.query('DELETE FROM conversion_items WHERE conversion_id = $1', [id]);
      await pool.query('DELETE FROM conversions WHERE id = $1', [id]);
    }
    await pool.query('DELETE FROM lead_status_history WHERE lead_id = $1', [leadId]);
    await pool.query('DELETE FROM leads WHERE id = $1', [leadId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productoId]);
    await pool.end();
  });

  const conversion = (extra) => request.post('/api/conversions').set('Authorization', `Bearer ${token}`)
    .send({ lead_id: leadId, project_id: PROYECTO, producto_contratado: 'Curso Fecha Inicio 767', importe_total: 300, importe_pagado: 0, ...extra });
  const registrar = (extra) => request.post('/api/ventas').set('Authorization', `Bearer ${token}`)
    .send({ project_id: PROYECTO, lead_id: leadId, producto_interes_id: productoId, importe_total: 300, importe_pagado: 0,
      metodo_pago: 'transferencia', fecha_pago: '2026-11-20', forzar: true, ...extra });

  it('POST /api/conversions sin fecha de inicio: 400 y no crea nada', async () => {
    const antes = (await pool.query('SELECT count(*)::int AS n FROM conversions WHERE lead_id = $1', [leadId])).rows[0].n;
    const res = await conversion({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(FALTA_FECHA_INICIO);
    const despues = (await pool.query('SELECT count(*)::int AS n FROM conversions WHERE lead_id = $1', [leadId])).rows[0].n;
    expect(despues).toBe(antes);
  });

  it('POST /api/conversions con fecha de inicio la guarda', async () => {
    const res = await conversion({ fecha_inicio: '2026-12-14', forzar: true });
    expect(res.status).toBe(201);
    ventas.push(res.body.data.id);
    const { rows } = await pool.query(`SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS f FROM conversions WHERE id = $1`, [res.body.data.id]);
    expect(rows[0].f).toBe('2026-12-14');
  });

  it('POST /api/ventas sin fecha de inicio: 400', async () => {
    const res = await registrar({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(FALTA_FECHA_INICIO);
  });

  it('POST /api/ventas con fecha de inicio (aunque ya haya pasado) la guarda en la venta', async () => {
    const res = await registrar({ fecha_inicio: '2026-10-05' });
    expect(res.status).toBe(201);
    const id = res.body.data.conversion_id ?? res.body.data.sale_id;
    ventas.push(id);
    const { rows } = await pool.query(`SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS f FROM conversions WHERE id = $1`, [id]);
    expect(rows[0].f).toBe('2026-10-05');
  });

  it('PATCH cambia la fecha de inicio de una venta', async () => {
    const id = ventas[0];
    const res = await request.patch(`/api/conversions/${id}`).set('Authorization', `Bearer ${token}`).send({ fecha_inicio: '2027-01-11' });
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS f FROM conversions WHERE id = $1`, [id]);
    expect(rows[0].f).toBe('2027-01-11');
  });
});
