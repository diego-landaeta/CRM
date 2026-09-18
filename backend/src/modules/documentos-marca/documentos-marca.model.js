import { query, getClient } from '../../shared/config/db.js';

/**
 * Los documentos de la marca (#91): la guía del campus y las homologaciones.
 *
 * Van con el correo del día 1 junto al dossier del curso. El dossier es de
 * cada formación y vive en `dossiers`; estos dos son de la MARCA —la guía del
 * campus de Psiko Aprende es la misma para sus veinte cursos— y por eso están
 * aparte. Guardarlos por curso sería subir el mismo PDF veinte veces y tener
 * veinte que cambiar el día que cambie.
 */

const COLS = `id, project_id, tipo, s3_key, filename_original, nombre_visible,
              size_bytes, version, active, subido_por, created_at, updated_at`;

/** Los vigentes de una marca. */
export async function vigentes(projectId) {
  const { rows } = await query(
    `SELECT ${COLS} FROM project_documents
      WHERE project_id = $1 AND active ORDER BY tipo`,
    [projectId]
  );
  return rows;
}

export async function porTipo(projectId, tipo) {
  const { rows } = await query(
    `SELECT ${COLS} FROM project_documents
      WHERE project_id = $1 AND tipo = $2 AND active`,
    [projectId, tipo]
  );
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${COLS} FROM project_documents WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Sube una versión nueva y jubila la anterior.
 *
 * En UNA transacción: si se desactivara la vieja y fallara el alta de la
 * nueva, la marca se quedaría sin documento vigente y el correo del día 1
 * dejaría de poder salir sin que nadie hubiera tocado nada.
 *
 * La vieja NO se borra. Un correo que salió hace dos meses llevaba la versión
 * de entonces, y saber cuál era es parte de poder responder a una reclamación.
 */
export async function nuevaVersion({ projectId, tipo, s3Key, filenameOriginal, nombreVisible, sizeBytes, subidoPor }) {
  const cliente = await getClient();
  try {
    await cliente.query('BEGIN');
    const { rows: previo } = await cliente.query(
      `SELECT version FROM project_documents
        WHERE project_id = $1 AND tipo = $2 AND active`,
      [projectId, tipo]
    );
    await cliente.query(
      `UPDATE project_documents SET active = FALSE, updated_at = NOW()
        WHERE project_id = $1 AND tipo = $2 AND active`,
      [projectId, tipo]
    );
    const { rows } = await cliente.query(
      `INSERT INTO project_documents
         (project_id, tipo, s3_key, filename_original, nombre_visible, size_bytes, version, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLS}`,
      [projectId, tipo, s3Key, filenameOriginal, nombreVisible || null, sizeBytes || null,
       (previo[0]?.version || 0) + 1, subidoPor]
    );
    await cliente.query('COMMIT');
    return rows[0];
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

/**
 * Qué le falta a esta marca para poder mandar el correo del día 1.
 *
 * Devuelve los tipos que NO tiene. El dossier no entra aquí: es del curso, y
 * quien pregunte por él tiene que decir de qué curso.
 */
export async function loQueFalta(projectId) {
  const tiene = (await vigentes(projectId)).map((d) => d.tipo);
  return ['guia_campus', 'homologaciones'].filter((t) => !tiene.includes(t));
}
