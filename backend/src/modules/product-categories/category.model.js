import { query } from '../../shared/config/db.js';

export async function listByProject(projectId) {
  const { rows } = await query(
    `SELECT c.*, p.nombre as parent_nombre
     FROM product_categories c
     LEFT JOIN product_categories p ON p.id = c.parent_id
     WHERE c.project_id = $1 AND c.active = true
     ORDER BY c.parent_id NULLS FIRST, c.orden, c.nombre`,
    [projectId]
  );
  return rows;
}

export async function create({ project_id, parent_id, nombre, orden = 0 }) {
  const { rows } = await query(
    `INSERT INTO product_categories (project_id, parent_id, nombre, orden)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [project_id, parent_id || null, nombre, orden]
  );
  return rows[0];
}

export async function update(id, data) {
  const allowed = ['nombre', 'parent_id', 'orden', 'active'];
  const sets = []; const params = []; let idx = 1;
  for (const k of allowed) {
    if (data[k] !== undefined) { sets.push(`${k} = $${idx++}`); params.push(data[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(
    `UPDATE product_categories SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0];
}

export async function remove(id) {
  await query(`UPDATE product_categories SET active = false WHERE id = $1`, [id]);
}
