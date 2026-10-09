import { query } from '../../shared/config/db.js';

/*
  El apartado Certifex del CRM: las consultas que llegan desde la web de Certifex.

  Un centro que quiere inscribir su campus, o cualquier otra consulta. Certifex las
  guarda y las reenvia aqui; ver la migracion 186 para el porque de una tabla propia.
*/

export const ESTADOS = ['nueva', 'en_curso', 'resuelta', 'spam'];

function fila(r) {
  if (!r) return null;
  return {
    id: r.id,
    certifexId: Number(r.certifex_id),
    tipo: r.tipo,
    nombre: r.nombre,
    email: r.email,
    telefono: r.telefono,
    organizacion: r.organizacion,
    urlCampus: r.url_campus,
    mensaje: r.mensaje,
    idioma: r.idioma,
    estado: r.estado,
    notaInterna: r.nota_interna,
    atendidaPor: r.atendida_por_nombre || null,
    recibidaEn: r.recibida_en,
    creadaEnCertifex: r.creada_en_certifex,
    updatedAt: r.updated_at,
  };
}

/**
 * Guarda una consulta que llega de Certifex. Si ya estaba (un reintento de Certifex
 * tras un corte trae el mismo `certifex_id`), no la duplica: devuelve `nueva: false`
 * para que no vuelva a sonar la campana.
 */
export async function recibir(c) {
  const { rows } = await query(
    `INSERT INTO certifex_consultas
       (certifex_id, tipo, nombre, email, telefono, organizacion, url_campus, mensaje, idioma, creada_en_certifex)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (certifex_id) DO NOTHING
     RETURNING *`,
    [c.certifexId, c.tipo, c.nombre, c.email, c.telefono || null, c.organizacion || null,
      c.urlCampus || null, c.mensaje, c.idioma || null, c.creadoEn || null],
  );
  if (rows[0]) return { consulta: fila(rows[0]), nueva: true };
  const ya = await query(`SELECT * FROM certifex_consultas WHERE certifex_id = $1`, [c.certifexId]);
  return { consulta: fila(ya.rows[0]), nueva: false };
}

export async function listar({ estado = null, tipo = null, pagina = 1, limite = 30 } = {}) {
  const lim = Math.min(100, Math.max(1, parseInt(limite, 10) || 30));
  const pag = Math.max(1, parseInt(pagina, 10) || 1);
  const { rows } = await query(
    `SELECT c.*, u.nombre AS atendida_por_nombre, COUNT(*) OVER() AS total
       FROM certifex_consultas c
       LEFT JOIN users u ON u.id = c.atendida_por
      WHERE ($1::text IS NULL OR c.estado = $1) AND ($2::text IS NULL OR c.tipo = $2)
      ORDER BY (c.estado = 'nueva') DESC, c.recibida_en DESC, c.id DESC
      LIMIT $3 OFFSET $4`,
    [estado, tipo, lim, (pag - 1) * lim],
  );
  return { filas: rows.map(fila), total: rows[0] ? Number(rows[0].total) : 0, pagina: pag, limite: lim };
}

export async function recuentoNuevas() {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM certifex_consultas WHERE estado = 'nueva'`);
  return rows[0]?.n ?? 0;
}

export async function actualizar(id, { estado, notaInterna }, userId) {
  const sets = ['atendida_por = $2', 'updated_at = NOW()'];
  const params = [id, userId];
  if (estado !== undefined) { params.push(estado); sets.push(`estado = $${params.length}`); }
  if (notaInterna !== undefined) { params.push(notaInterna); sets.push(`nota_interna = $${params.length}`); }
  const { rows } = await query(
    `UPDATE certifex_consultas SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );
  if (!rows[0]) return null;
  const u = await query(`SELECT nombre FROM users WHERE id = $1`, [userId]);
  return fila({ ...rows[0], atendida_por_nombre: u.rows[0]?.nombre || null });
}

// ── Solicitudes de diploma (#272, migracion 197) ─────────────────────────────

function solicitud(r) {
  if (!r) return null;
  return {
    id: r.id,
    matriculaId: Number(r.matricula_id),
    centro: r.centro,
    curso: { ref: r.curso_ref == null ? null : Number(r.curso_ref), nombre: r.curso_nombre },
    nombreDiploma: r.nombre_diploma,
    nombreMoodle: r.nombre_moodle,
    email: r.email,
    leadId: r.lead_id,
    solicitadaEn: r.solicitada_en,
    veces: r.veces,
    recibidaEn: r.recibida_en,
  };
}

/**
 * La ficha del CRM con ese correo, si hay: la mas reciente, sin las borradas ni las
 * de los proyectos de prueba. Es la misma clave que usa el cruce de Emisiones.
 */
export async function leadPorCorreo(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const { rows } = await query(
    `SELECT l.id FROM leads l
      WHERE l.deleted_at IS NULL AND lower(l.email) = $1
        AND l.project_id NOT IN (SELECT id FROM projects WHERE es_prueba)
      ORDER BY l.id DESC LIMIT 1`,
    [e],
  );
  return rows[0]?.id ?? null;
}

/**
 * Guarda la solicitud que avisa Certifex. Una fila por matricula:
 *  · `nueva`: no estaba.
 *  · `actualizada`: el alumno lo ha vuelto a pedir (otra fecha u otro nombre). Se
 *    actualiza la que habia y el aviso de rechazo anterior deja de valer.
 *  · `repetida`: un reintento identico de Certifex. No cambia nada ni debe avisar.
 */
export async function recibirSolicitud(s) {
  const leadId = await leadPorCorreo(s.alumno.email);
  const { rows } = await query(
    `INSERT INTO certifex_solicitudes
       (matricula_id, centro, curso_ref, curso_nombre, nombre_diploma, nombre_moodle, email, lead_id, solicitada_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (matricula_id) DO UPDATE SET
       centro = EXCLUDED.centro,
       curso_ref = EXCLUDED.curso_ref,
       curso_nombre = EXCLUDED.curso_nombre,
       nombre_diploma = EXCLUDED.nombre_diploma,
       nombre_moodle = EXCLUDED.nombre_moodle,
       email = EXCLUDED.email,
       lead_id = COALESCE(EXCLUDED.lead_id, certifex_solicitudes.lead_id),
       solicitada_en = EXCLUDED.solicitada_en,
       veces = CASE WHEN certifex_solicitudes.solicitada_en IS NULL THEN 1 ELSE certifex_solicitudes.veces + 1 END,
       aviso_rechazo_en = NULL,
       aviso_rechazo_por = NULL,
       aviso_rechazo_resultado = NULL,
       updated_at = NOW()
     WHERE certifex_solicitudes.solicitada_en IS DISTINCT FROM EXCLUDED.solicitada_en
        OR certifex_solicitudes.nombre_diploma IS DISTINCT FROM EXCLUDED.nombre_diploma
     RETURNING *, (xmax = 0) AS insertada`,
    [s.matriculaId, s.centro.toUpperCase(), s.curso?.ref ?? null, s.curso?.nombre ?? null,
      s.alumno.nombreDiploma, s.alumno.nombreMoodle || null, s.alumno.email || null, leadId, s.solicitadaEn],
  );
  if (rows[0]) return { solicitud: solicitud(rows[0]), estado: rows[0].insertada ? 'nueva' : 'actualizada' };
  const ya = await query(`SELECT * FROM certifex_solicitudes WHERE matricula_id = $1`, [s.matriculaId]);
  return { solicitud: solicitud(ya.rows[0]), estado: 'repetida' };
}

/** Los usuarios activos de administracion: a quienes suena la campana de una solicitud. */
export async function idsAdministracion() {
  const { rows } = await query(
    `SELECT id FROM users
      WHERE active = true
        AND (role IN ('admin', 'superadmin') OR roles_extra && ARRAY['admin', 'superadmin']::user_role[])`,
  );
  return rows.map((r) => r.id);
}

/** Apunta el aviso de rechazo que aprobo alguien del CRM, haya salido o no. */
export async function registrarAvisosRechazo(resultados, por) {
  for (const r of resultados) {
    if (!r?.matriculaId || !r.resultado) continue;
    await query(
      `INSERT INTO certifex_solicitudes (matricula_id, aviso_rechazo_en, aviso_rechazo_por, aviso_rechazo_resultado)
       VALUES ($1, NOW(), $2, $3)
       ON CONFLICT (matricula_id) DO UPDATE SET
         aviso_rechazo_en = NOW(), aviso_rechazo_por = $2, aviso_rechazo_resultado = $3, updated_at = NOW()`,
      [r.matriculaId, por, r.resultado],
    );
  }
}

/** El ultimo aviso de rechazo aprobado de cada matricula, por id. */
export async function avisosRechazoDe(matriculaIds) {
  if (!matriculaIds.length) return new Map();
  const { rows } = await query(
    `SELECT matricula_id, aviso_rechazo_en, aviso_rechazo_por, aviso_rechazo_resultado
       FROM certifex_solicitudes
      WHERE matricula_id = ANY($1::bigint[]) AND aviso_rechazo_en IS NOT NULL`,
    [matriculaIds],
  );
  return new Map(rows.map((r) => [Number(r.matricula_id), {
    en: r.aviso_rechazo_en, por: r.aviso_rechazo_por, resultado: r.aviso_rechazo_resultado,
  }]));
}
