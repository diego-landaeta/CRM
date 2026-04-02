import { query } from '../../shared/config/db.js';

export async function findByProject(projectId, { includeInactive = false } = {}) {
  const sql = includeInactive
    ? 'SELECT * FROM products WHERE project_id = $1 ORDER BY created_at DESC'
    : 'SELECT * FROM products WHERE project_id = $1 AND active = true ORDER BY created_at DESC';
  const { rows } = await query(sql, [projectId]);
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create({ projectId, nombre, descripcion }) {
  const { rows } = await query(
    `INSERT INTO products (project_id, nombre, descripcion)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [projectId, nombre, descripcion]
  );
  return rows[0];
}

export async function update(id, { nombre, descripcion }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(nombre); }
  if (descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(descripcion); }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
}

export async function deactivate(id) {
  const { rows } = await query(
    `UPDATE products SET active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

export async function findByProjectAndName(projectId, nombre) {
  const { rows } = await query(
    `SELECT * FROM products WHERE project_id = $1 AND nombre = $2 AND active = true`,
    [projectId, nombre]
  );
  return rows[0] || null;
}
