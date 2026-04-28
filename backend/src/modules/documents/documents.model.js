import pool from '../../shared/config/db.js';

export async function nextNumber(projectId, type) {
  const { rows } = await pool.query(`
    INSERT INTO document_counters (project_id, type, last_number)
    VALUES ($1, $2, 1)
    ON CONFLICT (project_id, type)
    DO UPDATE SET last_number = document_counters.last_number + 1
    RETURNING last_number
  `, [projectId, type]);
  return rows[0].last_number;
}

export async function createDocument(doc) {
  const { rows } = await pool.query(`
    INSERT INTO documents (project_id, type, number, client_nombre, client_dni, client_direccion, data, file_path, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [doc.project_id, doc.type, doc.number, doc.client_nombre, doc.client_dni,
      doc.client_direccion, JSON.stringify(doc.data), doc.file_path, doc.created_by]);
  return rows[0];
}

export async function listDocuments(projectId, type) {
  const params = [projectId];
  let where = 'WHERE project_id = $1';
  if (type) { params.push(type); where += ` AND type = $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT * FROM documents ${where} ORDER BY created_at DESC LIMIT 100`, params
  );
  return rows;
}

export async function getDocument(id, projectId) {
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE id=$1 AND project_id=$2', [id, projectId]
  );
  return rows[0] || null;
}

export async function deleteDocument(id, projectId) {
  await pool.query('DELETE FROM documents WHERE id=$1 AND project_id=$2', [id, projectId]);
}
