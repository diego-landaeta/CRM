import { query } from '../../shared/config/db.js';

export async function getCreds(projectId) {
  const { rows } = await query(`SELECT * FROM wc_credentials WHERE project_id = $1`, [projectId]);
  return rows[0] || null;
}
export async function upsertCreds(projectId, data) {
  const { rows } = await query(
    `INSERT INTO wc_credentials (
        project_id, store_url, consumer_key, consumer_secret,
        active, auto_sync_enabled, sync_interval_minutes, default_currency,
        wp_user, wp_app_password,
        source_strategy, cpt_endpoints,
        scraper_enabled, scrape_strategy, section_keywords
     )
     VALUES (
        $1, $2, $3, $4,
        COALESCE($5, true), COALESCE($6, false), COALESCE($7, 30), COALESCE($8, 'EUR'),
        $9, $10,
        COALESCE($11, 'wc_only'), COALESCE($12, '[]'::jsonb),
        COALESCE($13, false), COALESCE($14, 'plain_text'), $15
     )
     ON CONFLICT (project_id) DO UPDATE
       SET store_url = EXCLUDED.store_url,
           consumer_key = EXCLUDED.consumer_key,
           consumer_secret = CASE WHEN EXCLUDED.consumer_secret = '' THEN wc_credentials.consumer_secret ELSE EXCLUDED.consumer_secret END,
           active = EXCLUDED.active,
           auto_sync_enabled = EXCLUDED.auto_sync_enabled,
           sync_interval_minutes = EXCLUDED.sync_interval_minutes,
           default_currency = EXCLUDED.default_currency,
           wp_user = EXCLUDED.wp_user,
           wp_app_password = CASE WHEN EXCLUDED.wp_app_password = '' OR EXCLUDED.wp_app_password IS NULL
                                  THEN wc_credentials.wp_app_password ELSE EXCLUDED.wp_app_password END,
           source_strategy = EXCLUDED.source_strategy,
           cpt_endpoints = EXCLUDED.cpt_endpoints,
           scraper_enabled = EXCLUDED.scraper_enabled,
           scrape_strategy = EXCLUDED.scrape_strategy,
           section_keywords = COALESCE(EXCLUDED.section_keywords, wc_credentials.section_keywords),
           updated_at = NOW()
     RETURNING *`,
    [
      projectId,
      data.store_url, data.consumer_key, data.consumer_secret || '',
      data.active, data.auto_sync_enabled, data.sync_interval_minutes, data.default_currency,
      data.wp_user || null, data.wp_app_password || null,
      data.source_strategy, JSON.stringify(data.cpt_endpoints || []),
      data.scraper_enabled, data.scrape_strategy,
      data.section_keywords ? JSON.stringify(data.section_keywords) : null,
    ]
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

// Run más reciente (en curso si hay uno corriendo, o el último finalizado)
export async function getCurrentRun(projectId) {
  const { rows } = await query(
    `SELECT id, status, total_fetched, total_created, total_updated, total_skipped,
            error_message, started_at, finished_at,
            EXTRACT(EPOCH FROM (COALESCE(finished_at, NOW()) - started_at))::int AS elapsed_seconds
     FROM wc_import_runs WHERE project_id = $1
     ORDER BY started_at DESC LIMIT 1`,
    [projectId]
  );
  return rows[0] || null;
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
export async function upsertProductFromWc({ projectId, wcId, data }) {
  const existing = await findProductByWcId(projectId, wcId);
  const meta = data.meta || {};
  if (existing) {
    const { rows } = await query(
      `UPDATE products
       SET nombre=$1, precio=$2, descripcion=$3, sku=$4,
           categoria_id=$5, subcategoria_id=$6, wc_meta=$7, updated_at=NOW()
       WHERE id = $8 RETURNING id`,
      [data.nombre, data.precio, data.descripcion || null, data.sku || null,
       data.categoria_id || null, data.subcategoria_id || null,
       JSON.stringify(meta), existing.id]);
    return { action: 'updated', id: rows[0].id };
  }
  const { rows } = await query(
    `INSERT INTO products (project_id, nombre, precio, descripcion, sku,
                           categoria_id, subcategoria_id, wc_product_id, wc_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [projectId, data.nombre, data.precio, data.descripcion || null, data.sku || null,
     data.categoria_id || null, data.subcategoria_id || null,
     wcId, JSON.stringify(meta)]);
  return { action: 'created', id: rows[0].id };
}

// Upsert categoría WC → product_categories. Devuelve id local.
export async function upsertCategoryByWcId(projectId, wcCategoryId, nombre, parentLocalId) {
  // Buscar primero por external_id+source (idempotente entre re-syncs)
  const externalId = String(wcCategoryId);
  const ex = await query(
    `SELECT id FROM product_categories
     WHERE project_id = $1 AND source = 'wc' AND external_id = $2 LIMIT 1`,
    [projectId, externalId]
  );
  if (ex.rows[0]) {
    await query(
      `UPDATE product_categories SET nombre = $1, parent_id = $2, active = true, updated_at = NOW() WHERE id = $3`,
      [nombre, parentLocalId || null, ex.rows[0].id]
    );
    return ex.rows[0].id;
  }

  // Fallback: por nombre+parent (compat con categorías legacy sin external_id)
  const byName = await query(
    `SELECT id FROM product_categories
     WHERE project_id = $1 AND nombre = $2 AND parent_id IS NOT DISTINCT FROM $3 LIMIT 1`,
    [projectId, nombre, parentLocalId]
  );
  if (byName.rows[0]) {
    await query(
      `UPDATE product_categories SET source = 'wc', external_id = $1, updated_at = NOW() WHERE id = $2`,
      [externalId, byName.rows[0].id]
    );
    return byName.rows[0].id;
  }

  const { rows } = await query(
    `INSERT INTO product_categories (project_id, nombre, parent_id, source, external_id)
     VALUES ($1, $2, $3, 'wc', $4) RETURNING id`,
    [projectId, nombre, parentLocalId || null, externalId]
  );
  return rows[0].id;
}
