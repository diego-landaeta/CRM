import { query, getClient } from '../../shared/config/db.js';

// ===== RULES =====

export async function listRules({ projectId, userId, productId }) {
  const conds = ['cr.active = true'];
  const params = []; let idx = 1;
  if (projectId) { conds.push(`cr.project_id = $${idx++}`); params.push(projectId); }
  if (userId)    { conds.push(`cr.user_id = $${idx++}`);    params.push(userId); }
  if (productId) { conds.push(`cr.product_id = $${idx++}`); params.push(productId); }
  const { rows } = await query(
    `SELECT cr.*, u.nombre as user_nombre, u.email as user_email,
            p.nombre as product_nombre,
            pr.nombre as project_nombre
     FROM commission_rules cr
     JOIN users u ON u.id = cr.user_id
     JOIN products p ON p.id = cr.product_id
     JOIN projects pr ON pr.id = cr.project_id
     WHERE ${conds.join(' AND ')}
     ORDER BY pr.nombre, u.nombre, p.nombre`,
    params
  );
  return rows;
}

export async function createRule(data) {
  const { rows } = await query(
    `INSERT INTO commission_rules (project_id, user_id, product_id, pct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id) DO UPDATE
       SET pct = EXCLUDED.pct, active = true, updated_at = NOW()
     RETURNING *`,
    [data.project_id, data.user_id, data.product_id, data.pct]
  );
  return rows[0];
}

export async function updateRule(id, data) {
  const fields = []; const params = []; let idx = 1;
  if (data.pct !== undefined) { fields.push(`pct = $${idx++}`); params.push(data.pct); }
  if (data.active !== undefined) { fields.push(`active = $${idx++}`); params.push(data.active); }
  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(
    `UPDATE commission_rules SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0];
}

export async function deleteRule(id) {
  await query(`DELETE FROM commission_rules WHERE id = $1`, [id]);
}

export async function findRule({ userId, productId }) {
  const { rows } = await query(
    `SELECT * FROM commission_rules WHERE user_id = $1 AND product_id = $2 AND active = true LIMIT 1`,
    [userId, productId]
  );
  return rows[0] || null;
}

// ===== COMMISSIONS =====

export async function listCommissions({ userId, estado, from, to, projectId }) {
  const conds = [];
  const params = []; let idx = 1;
  if (userId) { conds.push(`c.user_id = $${idx++}`); params.push(userId); }
  if (estado) { conds.push(`c.estado = $${idx++}`); params.push(estado); }
  if (from)   { conds.push(`c.created_at >= $${idx++}`); params.push(from); }
  if (to)     { conds.push(`c.created_at <= $${idx++}`); params.push(to); }
  if (projectId) {
    conds.push(`EXISTS (SELECT 1 FROM conversions cv WHERE cv.id = c.conversion_id AND cv.project_id = $${idx++})`);
    params.push(projectId);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT c.*,
            u.nombre as user_nombre,
            p.nombre as product_nombre,
            l.nombre as lead_nombre,
            cv.fecha_conversion as fecha_compra,
            cv.producto_contratado,
            cv.importe_total as conv_total, cv.importe_pagado as conv_pagado,
            CASE
              WHEN cv.importe_pagado >= cv.importe_total THEN 'pagado'
              WHEN cv.importe_pagado > 0 THEN 'parcial'
              ELSE 'pendiente'
            END as estado_pago,
            pr.nombre as proyecto_nombre
     FROM commissions c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN products p ON p.id = c.product_id
     JOIN conversions cv ON cv.id = c.conversion_id
     LEFT JOIN leads l ON l.id = cv.lead_id
     LEFT JOIN projects pr ON pr.id = cv.project_id
     ${where}
     ORDER BY c.created_at DESC`,
    params
  );
  return rows;
}

export async function createCommissionForConversion(conversionId) {
  const c = await getClient();
  try {
    await c.query('BEGIN');
    // Conversion + responsable
    const { rows: cvRows } = await c.query(
      `SELECT cv.id, cv.lead_id, cv.producto_contratado_id, cv.importe_total, cv.importe_pagado, l.responsable_id
       FROM conversions cv JOIN leads l ON l.id = cv.lead_id WHERE cv.id = $1`,
      [conversionId]
    );
    const cv = cvRows[0];
    if (!cv || !cv.responsable_id || !cv.producto_contratado_id) {
      await c.query('COMMIT'); return null;
    }
    // Buscar regla
    const { rows: ruleRows } = await c.query(
      `SELECT id, pct FROM commission_rules WHERE user_id = $1 AND product_id = $2 AND active = true LIMIT 1`,
      [cv.responsable_id, cv.producto_contratado_id]
    );
    const rule = ruleRows[0];
    if (!rule) { await c.query('COMMIT'); return null; }

    // Importe base = total cobrado proporcional. De inicio = importe_pagado (puede ser 0)
    const base = Number(cv.importe_pagado || 0);
    const importe = Math.round(base * Number(rule.pct)) / 100;
    const { rows } = await c.query(
      `INSERT INTO commissions (conversion_id, rule_id, user_id, product_id, importe_base, pct, importe_comision)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (conversion_id) DO UPDATE
         SET importe_base = EXCLUDED.importe_base,
             importe_comision = EXCLUDED.importe_comision,
             pct = EXCLUDED.pct,
             updated_at = NOW()
       RETURNING *`,
      [conversionId, rule.id, cv.responsable_id, cv.producto_contratado_id, base, rule.pct, importe]
    );
    await c.query('COMMIT');
    return rows[0];
  } catch (err) { await c.query('ROLLBACK'); throw err; }
  finally { c.release(); }
}

export async function recalculateCommission(conversionId) {
  // Misma logica: actualiza importe_base/importe_comision basado en lo cobrado
  return createCommissionForConversion(conversionId);
}

export async function payCommission(id, fechaPago, notas) {
  const { rows } = await query(
    `UPDATE commissions
       SET estado = 'pagado',
           fecha_pago = COALESCE($1::date, CURRENT_DATE),
           notas = COALESCE($2, notas),
           updated_at = NOW()
     WHERE id = $3 AND estado = 'pendiente'
     RETURNING *`,
    [fechaPago || null, notas || null, id]
  );
  return rows[0];
}

export async function getStats({ userId, projectId, from, to }) {
  const conds = [];
  const params = []; let idx = 1;
  if (userId)    { conds.push(`c.user_id = $${idx++}`); params.push(userId); }
  if (projectId) {
    conds.push(`EXISTS (SELECT 1 FROM conversions cv WHERE cv.id = c.conversion_id AND cv.project_id = $${idx++})`);
    params.push(projectId);
  }
  if (from) { conds.push(`c.created_at >= $${idx++}`); params.push(from); }
  if (to)   { conds.push(`c.created_at <= $${idx++}`); params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT
       COALESCE(SUM(importe_comision), 0) as total,
       COALESCE(SUM(importe_comision) FILTER (WHERE estado = 'pagado'), 0) as pagado,
       COALESCE(SUM(importe_comision) FILTER (WHERE estado = 'pendiente'), 0) as pendiente,
       COUNT(*) as cantidad
     FROM commissions c ${where}`,
    params
  );
  return rows[0];
}
