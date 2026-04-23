import { query, getClient } from '../../shared/config/db.js';

export async function listByProject(projectId) {
  const { rows } = await query(
    `SELECT id, project_id, field_key, label, type, options, required, orden, grupo, active, created_at
     FROM project_field_definitions
     WHERE project_id = $1 AND active = true
     ORDER BY orden ASC, id ASC`,
    [projectId]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT * FROM project_field_definitions WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function create(data) {
  const { rows } = await query(
    `INSERT INTO project_field_definitions
       (project_id, field_key, label, type, options, required, orden, grupo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.project_id, data.field_key, data.label, data.type,
      data.options ? JSON.stringify(data.options) : null,
      data.required, data.orden, data.grupo || null,
    ]
  );
  return rows[0];
}

export async function update(id, fields) {
  const allowed = ['label', 'type', 'options', 'required', 'orden', 'grupo', 'active'];
  const sets = [];
  const params = [];
  let idx = 1;
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = $${idx++}`);
      params.push(k === 'options' && fields[k] !== null ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(`UPDATE project_field_definitions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  return rows[0];
}

export async function remove(id) {
  // Soft delete: marca como inactive
  await query(`UPDATE project_field_definitions SET active = false WHERE id = $1`, [id]);
}

export async function reorder(projectId, items) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const { id, orden } of items) {
      await client.query(
        `UPDATE project_field_definitions SET orden = $1 WHERE id = $2 AND project_id = $3`,
        [orden, id, projectId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function keyExists(projectId, fieldKey) {
  const { rows } = await query(
    `SELECT id FROM project_field_definitions WHERE project_id = $1 AND field_key = $2`,
    [projectId, fieldKey]
  );
  return rows.length > 0;
}
