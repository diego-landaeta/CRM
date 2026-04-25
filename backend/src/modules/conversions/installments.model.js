import { query, getClient } from '../../shared/config/db.js';

export async function listByConversion(conversionId) {
  const { rows } = await query(
    `SELECT * FROM conversion_installments WHERE conversion_id = $1 ORDER BY numero ASC`,
    [conversionId]
  );
  return rows;
}

export async function generateInstallments(conversionId, numCuotas, importeTotal, fechaInicio) {
  // Genera N cuotas iguales mensuales desde fechaInicio
  const c = await getClient();
  try {
    await c.query('BEGIN');
    // Borra anteriores no cobradas
    await c.query(`DELETE FROM conversion_installments WHERE conversion_id = $1 AND fecha_cobro IS NULL`, [conversionId]);
    const importeCuota = Math.round((Number(importeTotal) / numCuotas) * 100) / 100;
    const start = new Date(fechaInicio);
    for (let i = 0; i < numCuotas; i++) {
      const venc = new Date(start);
      venc.setMonth(venc.getMonth() + i);
      const importe = i === numCuotas - 1
        // ultima cuota = total - sum(anteriores) para evitar redondeos
        ? Math.round((Number(importeTotal) - importeCuota * (numCuotas - 1)) * 100) / 100
        : importeCuota;
      await c.query(
        `INSERT INTO conversion_installments (conversion_id, numero, importe_previsto, fecha_vencimiento)
         VALUES ($1, $2, $3, $4)`,
        [conversionId, i + 1, importe, venc.toISOString().slice(0, 10)]
      );
    }
    await c.query('COMMIT');
    return await listByConversion(conversionId);
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}

export async function update(id, data) {
  const allowed = ['fecha_vencimiento', 'importe_previsto', 'enviar_email', 'notas'];
  const sets = []; const params = []; let idx = 1;
  for (const k of allowed) {
    if (data[k] !== undefined) { sets.push(`${k} = $${idx++}`); params.push(data[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(`UPDATE conversion_installments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  return rows[0];
}

export async function markPaid(id, { fecha_cobro, importe_cobrado, metodo, notas }) {
  const c = await getClient();
  try {
    await c.query('BEGIN');
    const { rows: instRows } = await c.query(`SELECT * FROM conversion_installments WHERE id = $1 FOR UPDATE`, [id]);
    const inst = instRows[0];
    if (!inst) { await c.query('ROLLBACK'); return null; }
    if (inst.fecha_cobro) { await c.query('ROLLBACK'); throw new Error('Cuota ya cobrada'); }
    // Crear payment
    const { rows: payRows } = await c.query(
      `INSERT INTO conversion_payments (conversion_id, importe, fecha, notas)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [inst.conversion_id, importe_cobrado || inst.importe_previsto, fecha_cobro, notas || `Cuota ${inst.numero}`]
    );
    // Actualizar conversion importe_pagado
    await c.query(
      `UPDATE conversions SET importe_pagado = importe_pagado + $1, updated_at = NOW() WHERE id = $2`,
      [importe_cobrado || inst.importe_previsto, inst.conversion_id]
    );
    // Marcar cuota
    const { rows } = await c.query(
      `UPDATE conversion_installments
         SET fecha_cobro = $1, importe_cobrado = $2, metodo = $3, payment_id = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [fecha_cobro, importe_cobrado || inst.importe_previsto, metodo || null, payRows[0].id, id]
    );
    await c.query('COMMIT');
    return rows[0];
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}

export async function remove(id) {
  await query(`DELETE FROM conversion_installments WHERE id = $1 AND fecha_cobro IS NULL`, [id]);
}
