import { query } from '../../shared/config/db.js';
import crypto from 'crypto';

export async function findAll({ active }) {
  const where = active === undefined ? '' : `WHERE active = ${active === 'true' || active === true}`;
  const { rows } = await query(
    `SELECT id, nombre, slug, type, emoji, logo_url, logo_key, producto_label, producto_label_plural,
            modules,
            webhook_api_key, meta_account_id, google_account_id,
            gsc_property, dias_alerta_inactividad, active, created_at, updated_at
     FROM projects ${where}
     ORDER BY nombre ASC`
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT id, nombre, slug, type, emoji, logo_url, logo_key, producto_label, producto_label_plural,
            modules,
            webhook_api_key, meta_account_id, google_account_id,
            gsc_property, dias_alerta_inactividad, active, created_at, updated_at
     FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function slugExists(slug, excludeId = null) {
  const params = excludeId ? [slug, excludeId] : [slug];
  const clause = excludeId ? 'AND id != $2' : '';
  const { rows } = await query(
    `SELECT id FROM projects WHERE slug = $1 ${clause}`,
    params
  );
  return rows.length > 0;
}

export async function create(data) {
  const webhookKey = `whk_${data.slug.replace(/-/g, '')}_${crypto.randomUUID()}`;
  const { rows } = await query(
    `INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key, meta_account_id,
                           google_account_id, gsc_property, dias_alerta_inactividad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [data.nombre, data.slug, data.type, data.emoji, webhookKey, data.meta_account_id,
     data.google_account_id, data.gsc_property, data.dias_alerta_inactividad]
  );

  // Inicializar round-robin queue si es CRM
  if (data.type === 'crm') {
    await query(
      `INSERT INTO project_queue_state (project_id, last_assigned_index) VALUES ($1, 0)
       ON CONFLICT DO NOTHING`,
      [rows[0].id]
    );
  }

  return rows[0];
}

export async function update(id, fields) {
  const allowed = ['nombre', 'type', 'emoji', 'meta_account_id', 'google_account_id',
                   'gsc_property', 'dias_alerta_inactividad', 'active',
                   'producto_label', 'producto_label_plural', 'logo_url', 'logo_key', 'modules',
                   'lead_base_fields_config', 'lead_columns'];
  const sets = [];
  const params = [];
  let idx = 1;
  const jsonbFields = new Set(['modules', 'lead_base_fields_config', 'lead_columns']);
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = $${idx++}`);
      params.push(jsonbFields.has(k) ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  return rows[0];
}

export async function regenerateWebhookKey(id) {
  const { rows: r1 } = await query(`SELECT slug FROM projects WHERE id = $1`, [id]);
  if (!r1[0]) return null;
  const newKey = `whk_${r1[0].slug.replace(/-/g, '')}_${crypto.randomUUID()}`;
  const { rows } = await query(
    `UPDATE projects SET webhook_api_key = $1, updated_at = NOW() WHERE id = $2 RETURNING webhook_api_key`,
    [newKey, id]
  );
  return rows[0]?.webhook_api_key || null;
}
