import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../src/shared/config/db.js';
import { ventasSinFormacion } from '../src/modules/sales/sales.service.js';

/**
 * Las ventas que no dicen de qué formación son (#41).
 *
 * 321 cobradas sin curso del catálogo detrás —272 en ISEIE y 49 en MultiCRM—.
 * La consecuencia no es estética: sin formación no se sabe de quién es la
 * comisión y NINGÚN PROFESOR COBRA por ellas.
 *
 * Esto cubre las dos primeras subfases: sacar la lista, y cruzar
 * automáticamente las que se puedan por el nombre. Va contra Postgres porque
 * el cruce es SQL —normalización de tildes y mayúsculas incluida— y un mock
 * del SQL no prueba el SQL.
 *
 * Lo que más importa de aquí es lo que NO propone:
 *
 *   - con DOS cursos que normalizan igual, no sugiere ninguno. Adivinar cuál
 *     de los dos es exactamente lo que no puede hacer una máquina: atar un
 *     cobro a la formación equivocada se paga a quien no era, y eso no se ve
 *     en ningún aviso.
 *   - una venta SIN COBRAR no entra: la comisión nace del cobro.
 */

/*
  PROYECTO PROPIO, y no el 1.

  La consulta devuelve las ventas de TODO un proyecto, y en el 1 escriben a la
  vez otros ficheros de la suite. Con el 1 esto pasó aislado y falló una vez en
  la suite entera — intermitente, que es tan malo como rojo: la siguiente vez
  que falle nadie sabrá si es de verdad.

  Con proyecto propio nadie interfiere y esta prueba no interfiere con nadie.
*/
let PROYECTO;
const creado = { productos: [], leads: [], ventas: [] };

async function producto(nombre) {
  const { rows } = await pool.query(
    `INSERT INTO products (project_id, nombre, precio, active)
     VALUES ($1, $2, 100, TRUE) RETURNING id`, [PROYECTO, nombre]);
  creado.productos.push(rows[0].id);
  return rows[0].id;
}

async function venta({ texto, productoId = null, conCobro = true }) {
  const { rows: l } = await pool.query(
    `INSERT INTO leads (project_id, nombre, email, status, created_at, fecha_solicitud)
     VALUES ($1, 'Alumno SinForm', $2, 'convertido', '2026-02-01', '2026-02-01') RETURNING id`,
    [PROYECTO, `sinform-${Math.random().toString(36).slice(2, 9)}@test.com`]);
  creado.leads.push(l[0].id);
  const { rows: c } = await pool.query(
    `INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id,
                              importe_total, importe_pagado, fecha_conversion)
     VALUES ($1, $2, $3, $4, 300, 300, '2026-02-10') RETURNING id`,
    [l[0].id, PROYECTO, texto, productoId]);
  creado.ventas.push(c[0].id);
  if (conCobro) {
    await pool.query(
      `INSERT INTO conversion_payments (conversion_id, importe, fecha, metodo)
       VALUES ($1, 300, '2026-02-10', 'tarjeta')`, [c[0].id]);
  }
  return c[0].id;
}

let idUnico;
beforeAll(async () => {
  const { rows } = await pool.query(
    `INSERT INTO projects (nombre, slug, webhook_api_key, type)
     VALUES ('SinFormacion Test', 'sinformacion-test', 'whk_sinform_test', 'crm') RETURNING id`);
  PROYECTO = rows[0].id;
  idUnico = await producto('Diplomado en Neurociencia');
  await producto('Curso de Algo Repetido');
  await producto('Curso de Algo Repetído');   // mismo nombre normalizado
});

afterAll(async () => {
  for (const id of creado.ventas) {
    await pool.query('DELETE FROM conversion_payments WHERE conversion_id = $1', [id]);
    await pool.query('DELETE FROM conversions WHERE id = $1', [id]);
  }
  for (const id of creado.leads) {
    await pool.query('DELETE FROM lead_status_history WHERE lead_id = $1', [id]);
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
  }
  await pool.query('DELETE FROM products WHERE id = ANY($1::int[])', [creado.productos]);
  await pool.query('DELETE FROM projects WHERE id = $1', [PROYECTO]);
  await pool.end();
});

describe('qué entra en la lista', () => {
  it('una venta sin curso del catálogo entra', async () => {
    const id = await venta({ texto: 'Diplomado en Neurociencia' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.map((f) => f.id)).toContain(id);
  });

  it('una que SÍ tiene curso no entra', async () => {
    const id = await venta({ texto: 'Diplomado en Neurociencia', productoId: idUnico });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.map((f) => f.id)).not.toContain(id);
  });

  it('una SIN COBRAR tampoco: la comisión nace del cobro', async () => {
    const id = await venta({ texto: 'Diplomado en Neurociencia', conCobro: false });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.map((f) => f.id)).not.toContain(id);
  });
});

describe('el cruce automático', () => {
  it('propone el curso cuando el nombre coincide', async () => {
    const id = await venta({ texto: 'Diplomado en Neurociencia' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    const f = r.filas.find((x) => x.id === id);
    expect(f.sugerencia?.id).toBe(idUnico);
  });

  it('ignora tildes y mayúsculas, como el alta', async () => {
    const id = await venta({ texto: 'DIPLOMADO EN NEUROCIÉNCIA' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.find((x) => x.id === id).sugerencia?.id).toBe(idUnico);
  });

  it('con DOS cursos que normalizan igual NO propone ninguno', async () => {
    // Lo importante de toda esta pieza. Atar el cobro a la formación
    // equivocada se paga a quien no era, y eso no sale en ningún aviso.
    const id = await venta({ texto: 'Curso de Algo Repetido' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.find((x) => x.id === id).sugerencia).toBeNull();
  });

  it('sin ningún curso parecido, tampoco', async () => {
    const id = await venta({ texto: 'Algo que no está en el catálogo' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.find((x) => x.id === id).sugerencia).toBeNull();
  });

  it('el texto sucio se limpia antes de cruzar', async () => {
    // «Producto/servicio: servicio académico, …» es lo que traía el pago, y
    // sin quitarlo no cruza con nada.
    const id = await venta({ texto: 'Producto/servicio: servicio académico, Diplomado en Neurociencia' });
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.filas.find((x) => x.id === id).sugerencia?.id).toBe(idUnico);
  });
});

describe('el resumen', () => {
  it('cuenta las que tienen sugerencia y suma el importe', async () => {
    const r = await ventasSinFormacion({ projectId: PROYECTO });
    expect(r.total).toBe(r.filas.length);
    expect(r.conSugerencia).toBe(r.filas.filter((f) => f.sugerencia).length);
    expect(r.importe).toBeGreaterThan(0);
  });
});
