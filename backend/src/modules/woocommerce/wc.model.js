import { query } from '../../shared/config/db.js';

export async function getCreds(projectId) {
  const { rows } = await query(`SELECT * FROM wc_credentials WHERE project_id = $1`, [projectId]);
  return rows[0] || null;
}
export async function upsertCreds(projectId, data) {
  const { rows } = await query(
    `INSERT INTO wc_credentials (project_id, store_url, consumer_key, consumer_secret, active, auto_sync_enabled, sync_interval_minutes)
     VALUES ($1, $2, $3, $4, COALESCE($5, true), COALESCE($6, false), COALESCE($7, 30))
     ON CONFLICT (project_id) DO UPDATE
       SET store_url = EXCLUDED.store_url, consumer_key = EXCLUDED.consumer_key,
           consumer_secret = CASE WHEN EXCLUDED.consumer_secret = '' THEN wc_credentials.consumer_secret ELSE EXCLUDED.consumer_secret END,
           active = EXCLUDED.active,
           auto_sync_enabled = EXCLUDED.auto_sync_enabled,
           sync_interval_minutes = EXCLUDED.sync_interval_minutes,
           updated_at = NOW()
     RETURNING *`,
    [projectId, data.store_url, data.consumer_key, data.consumer_secret || '', data.active, data.auto_sync_enabled, data.sync_interval_minutes]
  );
  return rows[0];
}
export async function deleteCreds(projectId) { await query(`DELETE FROM wc_credentials WHERE project_id = $1`, [projectId]); }

export async function listMappings(projectId) {
  const { rows } = await query(`SELECT * FROM wc_field_mappings WHERE project_id = $1 ORDER BY id`, [projectId]);
  return rows;
}
export async function setMappings(projectId, mappings) {
  await query(`DELETE FROM wc_field_mappings WHERE project_id = $1`, [projectId]);
  for (const m of mappings) {
    await query(`INSERT INTO wc_field_mappings (project_id, wc_field, crm_field, is_meta) VALUES ($1, $2, $3, $4)`, [projectId, m.wc_field, m.crm_field, !!m.is_meta]);
  }
  return listMappings(projectId);
}

export async function listRuns(projectId) {
  const { rows } = await query(`SELECT * FROM wc_import_runs WHERE project_id = $1 ORDER BY started_at DESC LIMIT 50`, [projectId]);
  return rows;
}
export async function startRun(projectId, userId) {
  const { rows } = await query(`INSERT INTO wc_import_runs (project_id, triggered_by) VALUES ($1, $2) RETURNING *`, [projectId, userId]);
  return rows[0];
}
export async function finishRun(id, fields) {
  const { rows } = await query(
    `UPDATE wc_import_runs SET status=$2, total_fetched=$3, total_created=$4, total_updated=$5, total_skipped=$6, error_message=$7, finished_at=NOW() WHERE id=$1 RETURNING *`,
    [id, fields.status, fields.total_fetched || 0, fields.total_created || 0, fields.total_updated || 0, fields.total_skipped || 0, fields.error_message || null]);
  return rows[0];
}

export async function findProductByWcId(projectId, wcId) {
  const { rows } = await query(`SELECT id FROM products WHERE project_id = $1 AND wc_product_id = $2`, [projectId, wcId]);
  return rows[0] || null;
}
export async function upsertProductFromWc({ projectId, wcId, data, meta }) {
  const existing = await findProductByWcId(projectId, wcId);
  if (existing) {
    const { rows } = await query(
      `UPDATE products SET nombre=$1, precio=$2, descripcion=$3, wc_meta=$4, updated_at=NOW() WHERE id = $5 RETURNING id`,
      [data.nombre, data.precio, data.descripcion || null, JSON.stringify(meta || {}), existing.id]);
    return { action: 'updated', id: rows[0].id };
  }
  const { rows } = await query(
    `INSERT INTO products (project_id, nombre, precio, descripcion, wc_product_id, wc_meta)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [projectId, data.nombre, data.precio, data.descripcion || null, wcId, JSON.stringify(meta || {})]);
  return { action: 'created', id: rows[0].id };
}
