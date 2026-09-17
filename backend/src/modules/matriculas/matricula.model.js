import { query } from '../../shared/config/db.js';

/**
 * Como se puede ordenar la lista (#40).
 *
 * Lista cerrada y no la cadena que llegue: esto se pega detras de ORDER BY.
 * Con `sort` libre, un `?sort=(SELECT...)` entra directo en la consulta —los
 * parametros de `pg` no valen para nombres de columna, solo para valores—.
 */
const ORDENES = {
  recent: 'm.created_at DESC',
  oldest: 'm.created_at ASC',
  nombre: 'l.nombre ASC NULLS LAST',
  estado: 'm.estado ASC, m.created_at DESC',
  importe: 'c.importe_total DESC NULLS LAST',
};

export async function findAll({
  projectId, estado, search, responsableId, productoId, from, to,
  sort = 'recent', page = 1, limit = 50,
}) {
  const conditions = ['m.project_id = $1'];
  const params = [projectId];
  let idx = 2;
  if (estado) { conditions.push(`m.estado = $${idx++}`); params.push(estado); }
  // Recortado, igual que en leads: un espacio pegado al nombre vaciaba la lista.
  const termino = typeof search === 'string' ? search.trim() : '';
  if (termino) {
    conditions.push(`(l.nombre ILIKE $${idx} OR l.email ILIKE $${idx} OR m.dni ILIKE $${idx})`);
    params.push(`%${termino}%`);
    idx++;
  }
  // La gestora sale del LEAD, no de la matricula: la matricula no lleva dueño.
  // Es tambien lo que usa el recorte por rol del controlador, asi que las dos
  // cosas —filtrar y recortar— preguntan por la misma columna.
  if (responsableId) { conditions.push(`l.responsable_id = $${idx++}`); params.push(responsableId); }
  // El producto vive en la CONVERSION, no en la matricula. Una matricula sin
  // conversion asociada no tiene producto y se cae del filtro, que es lo
  // correcto: no se puede afirmar que sea de ese curso.
  if (productoId) { conditions.push(`c.producto_contratado_id = $${idx++}`); params.push(productoId); }
  // Fechas sobre el alta de la matricula. `to` incluye el dia entero: quien
  // pone 30/09 espera ver lo del 30, no «hasta las 00:00 del 30».
  if (from) { conditions.push(`m.created_at >= $${idx++}::date`); params.push(from); }
  if (to) { conditions.push(`m.created_at < ($${idx++}::date + interval '1 day')`); params.push(to); }

  const orden = ORDENES[sort] || ORDENES.recent;
  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (page - 1) * limit;
  // El COUNT tiene que llevar LAS MISMAS uniones que el listado. Solo unia con
  // `leads`, asi que al filtrar por producto —que vive en `conversions`— la
  // consulta reventaba con «missing FROM-clause entry for table c». Y aunque no
  // reventara: un total calculado sobre otro conjunto pagina mal, y eso no se
  // ve, solo salen paginas vacias al final.
  const { rows: cnt } = await query(
    `SELECT COUNT(*) FROM matriculas m
       LEFT JOIN leads l ON l.id = m.lead_id
       LEFT JOIN conversions c ON c.id = m.conversion_id
     ${where}`, params);
  const total = parseInt(cnt[0].count);
  const { rows } = await query(
    `SELECT m.*, l.nombre as lead_nombre, l.email as lead_email, l.telefono as lead_telefono,
            l.responsable_id, r.nombre as responsable_nombre,
            c.importe_total, c.producto_contratado, c.producto_contratado_id,
            u.nombre as validated_by_nombre
     FROM matriculas m
     LEFT JOIN leads l ON l.id = m.lead_id
     LEFT JOIN conversions c ON c.id = m.conversion_id
     LEFT JOIN users u ON u.id = m.validated_by
     LEFT JOIN users r ON r.id = l.responsable_id
     ${where}
     ORDER BY ${orden}
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  return { matriculas: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT m.*, l.nombre as lead_nombre, l.email as lead_email,
            c.importe_total, c.producto_contratado, u.nombre as validated_by_nombre
     FROM matriculas m
     LEFT JOIN leads l ON l.id = m.lead_id
     LEFT JOIN conversions c ON c.id = m.conversion_id
     LEFT JOIN users u ON u.id = m.validated_by
     WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

export async function findByConversion(conversionId) {
  const { rows } = await query(`SELECT * FROM matriculas WHERE conversion_id = $1`, [conversionId]);
  return rows[0] || null;
}

export async function create(data) {
  const dedupe = data.dedupe_key || data.dni || null;
  const { rows } = await query(
    `INSERT INTO matriculas (project_id, conversion_id, lead_id, dni, titulo, notas, datos_admision, source, dedupe_key, estado, webhook_received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [data.project_id, data.conversion_id || null, data.lead_id || null,
     data.dni || null, data.titulo || null, data.notas || null,
     data.datos_admision ? JSON.stringify(data.datos_admision) : null,
     data.source || 'manual', dedupe,
     data.estado || (data.source === 'webhook' ? 'solicitud_admision' : 'pendiente'),
     data.source === 'webhook' ? new Date() : null]
  );
  return rows[0];
}

export async function findByDedupe(projectId, dedupeKey) {
  if (!dedupeKey) return null;
  const { rows } = await query(`SELECT * FROM matriculas WHERE project_id = $1 AND dedupe_key = $2`, [projectId, dedupeKey]);
  return rows[0] || null;
}

export async function update(id, fields) {
  const allowed = ['dni', 'titulo', 'notas', 'dni_doc_url', 'dni_doc_key', 'titulo_doc_url', 'titulo_doc_key', 'firma_url', 'firma_key'];
  const sets = []; const params = []; let idx = 1;
  for (const k of allowed) {
    if (fields[k] !== undefined) { sets.push(`${k} = $${idx++}`); params.push(fields[k]); }
  }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await query(`UPDATE matriculas SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  return rows[0];
}

export async function setEstado(id, estado, userId, motivo = null) {
  const { rows } = await query(
    `UPDATE matriculas
       SET estado = $1, motivo_rechazo = $2,
           validated_by = $3, validated_at = NOW(), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [estado, estado === 'rechazada' ? motivo : null, userId, id]
  );
  return rows[0];
}

export async function remove(id) {
  await query(`DELETE FROM matriculas WHERE id = $1`, [id]);
}

/**
 * Los cuatro contadores de la cabecera.
 *
 * `responsableId` recorta igual que el listado, y no es un adorno: con la lista
 * recortada y las cifras sin recortar, una gestora leeria «40 matriculas» sobre
 * una tabla de cinco filas. Se reporta como «no me cargan», y lo que pasa es
 * que las otras treinta y cinco no son suyas.
 */
export async function getStats(projectId, responsableId = null) {
  const params = [projectId];
  let filtro = '';
  if (responsableId) {
    params.push(responsableId);
    filtro = ' AND l.responsable_id = $2';
  }
  const { rows } = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE m.estado = 'pendiente') as pendientes,
       COUNT(*) FILTER (WHERE m.estado = 'validada') as validadas,
       COUNT(*) FILTER (WHERE m.estado = 'rechazada') as rechazadas
     FROM matriculas m
     LEFT JOIN leads l ON l.id = m.lead_id
     WHERE m.project_id = $1${filtro}`, params);
  return rows[0];
}
