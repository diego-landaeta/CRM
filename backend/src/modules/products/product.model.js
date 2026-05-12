import { query } from '../../shared/config/db.js';

export async function findByProject(projectId, { includeInactive = false, categoryId = null } = {}) {
  const params = [projectId];
  let categoryFilter = '';
  if (categoryId) {
    // Filtra por categoría incluyendo TODOS sus descendientes (CTE recursivo)
    categoryFilter = `AND p.categoria_id IN (
      WITH RECURSIVE d AS (
        SELECT id FROM product_categories WHERE id = $2
        UNION ALL
        SELECT c.id FROM product_categories c JOIN d ON c.parent_id = d.id
      )
      SELECT id FROM d
    )`;
    params.push(categoryId);
  }
  const base = `SELECT p.*, c.nombre as categoria_nombre, sc.nombre as subcategoria_nombre
                FROM products p
                LEFT JOIN product_categories c ON c.id = p.categoria_id
                LEFT JOIN product_categories sc ON sc.id = p.subcategoria_id
                WHERE p.project_id = $1 ${categoryFilter}`;
  const sql = includeInactive
    ? base + ' ORDER BY p.created_at DESC'
    : base + ' AND p.active = true ORDER BY p.created_at DESC';
  const { rows } = await query(sql, params);
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create({ projectId, nombre, descripcion, categoria_id, subcategoria_id, precio, moneda, stripe_link, sku, duracion, url_info }) {
  const { rows } = await query(
    `INSERT INTO products (project_id, nombre, descripcion, categoria_id, subcategoria_id, precio, moneda, stripe_link, sku, duracion, url_info)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'EUR'), $8, $9, $10, $11)
     RETURNING *`,
    [projectId, nombre, descripcion, categoria_id || null, subcategoria_id || null,
     precio ?? null, moneda || null, stripe_link || null, sku || null, duracion || null, url_info || null]
  );
  return rows[0];
}

export async function update(id, data) {
  const allowed = ['nombre', 'descripcion', 'categoria_id', 'subcategoria_id',
                   'precio', 'moneda', 'stripe_link', 'sku', 'duracion', 'url_info',
                   'image_url',
                   'horas', 'num_modulos', 'modalidad', 'fecha_inicio_texto',
                   'presentacion_texto', 'objetivos_texto', 'beneficios_texto',
                   'dirigido_a_texto', 'para_que_te_prepara_texto', 'por_que_estudiar_texto',
                   'modulos_texto', 'metodologia_texto', 'faqs_texto', 'profesores_texto'];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const k of allowed) {
    if (data[k] !== undefined) { fields.push(`${k} = $${idx++}`); values.push(data[k]); }
  }

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
