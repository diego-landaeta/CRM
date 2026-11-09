import { query } from '../../shared/config/db.js';
import { decrypt } from '../../shared/utils/crypto.js';
import { logger } from '../../shared/utils/logger.js';
import { comoIds } from '../../shared/utils/roles.js';

/*
  Zadarma (#137): lo que se lee y se escribe en la base. SQL directo.

  Las credenciales viven en `project_integrations` (provider = 'zadarma'), con
  el mismo cifrado que Stripe: la CLAVE en las columnas de la fila y el SECRETO
  dentro de `config_public`, con su propio iv y su etiqueta (como el whsec_ de
  Stripe; ver integrations.controller.js). Migración 249 para lo demás.
*/

const TZ_POR_DEFECTO = 'Europe/Madrid';

function descifrarFila(fila) {
  const c = fila.config_public || {};
  if (!fila.encrypted_value || !c.zadarma_secret_encrypted) return null;
  try {
    return {
      projectId: Number(fila.project_id),
      clave: decrypt(fila.encrypted_value, fila.iv, fila.auth_tag),
      secreto: decrypt(c.zadarma_secret_encrypted, c.zadarma_secret_iv, c.zadarma_secret_auth_tag),
      zonaHoraria: c.zona_horaria || TZ_POR_DEFECTO,
    };
  } catch (err) {
    // Una ENCRYPTION_KEY cambiada deja la fila ilegible: ese campus queda como
    // «no conectado», y se apunta para que alguien lo mire.
    logger.warn({ project_id: fila.project_id, err: err.message }, 'zadarma: credencial no descifrable');
    return null;
  }
}

/** Las credenciales de un campus, o null si no está conectado (sin fila, apagado o sin secreto). */
export async function credencialesDelCampus(projectId) {
  const { rows } = await query(
    `SELECT project_id, encrypted_value, iv, auth_tag, config_public
       FROM project_integrations
      WHERE project_id = $1 AND provider = 'zadarma' AND active`,
    [projectId]
  );
  return rows[0] ? descifrarFila(rows[0]) : null;
}

/** Todos los campus con Zadarma conectado: para saber de qué cuenta es un aviso. */
export async function credencialesDeTodos() {
  const { rows } = await query(
    `SELECT project_id, encrypted_value, iv, auth_tag, config_public
       FROM project_integrations
      WHERE provider = 'zadarma' AND active AND encrypted_value IS NOT NULL
      ORDER BY project_id`
  );
  return rows.map(descifrarFila).filter(Boolean);
}

/**
 * Los campus con Zadarma conectado que alcanza esta persona, con SU extensión
 * en cada uno (null si no tiene). `campus` null = todos (superadmin, soporte).
 */
export async function estadoParaLaPersona(userId, campus) {
  const { rows } = await query(
    `SELECT pi.project_id, up.zadarma_extension AS extension
       FROM project_integrations pi
       LEFT JOIN user_projects up
              ON up.project_id = pi.project_id AND up.user_id = $1 AND up.active
      WHERE pi.provider = 'zadarma' AND pi.active
        AND pi.encrypted_value IS NOT NULL
        AND pi.config_public ? 'zadarma_secret_encrypted'
        AND ($2::int[] IS NULL OR pi.project_id = ANY($2::int[]))
      ORDER BY pi.project_id`,
    [userId, campus]
  );
  return rows.map((r) => ({ project_id: Number(r.project_id), extension: r.extension || null }));
}

/** ¿Alguno de estos campus tiene Zadarma conectado? */
export async function algunoConectado(projectIds) {
  const { rows } = await query(
    `SELECT 1 FROM project_integrations
      WHERE provider = 'zadarma' AND active AND encrypted_value IS NOT NULL
        AND project_id = ANY($1::int[])
      LIMIT 1`,
    [projectIds]
  );
  return rows.length > 0;
}

export async function leadParaLlamar(leadId) {
  const { rows } = await query(
    `SELECT id, project_id, nombre, telefono, responsable_id
       FROM leads WHERE id = $1 AND deleted_at IS NULL`,
    [leadId]
  );
  return rows[0] || null;
}

export async function extensionDe(userId, projectId) {
  const { rows } = await query(
    `SELECT zadarma_extension FROM user_projects
      WHERE user_id = $1 AND project_id = $2 AND active`,
    [userId, projectId]
  );
  return rows[0]?.zadarma_extension || null;
}

export async function apuntarPedida({ projectId, leadId, userId, extension, numero }) {
  const { rows } = await query(
    `INSERT INTO llamadas_pedidas (project_id, lead_id, user_id, extension, numero)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, pedida_at`,
    [projectId, leadId, userId, extension, numero]
  );
  return rows[0];
}

// ─── Extensiones (las edita el admin desde Integraciones) ──────────────────

/** Las personas de un campus que pueden llamar, con su extensión. */
export async function extensionesDelCampus(projectId) {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.nombre, u.role, up.zadarma_extension AS extension
       FROM user_projects up
       JOIN users u ON u.id = up.user_id
      WHERE up.project_id = $1 AND up.active AND u.active
        AND u.role IN ('gestor', 'admin', 'project_manager', 'soporte', 'superadmin')
      ORDER BY (up.zadarma_extension IS NULL), u.nombre`,
    [projectId]
  );
  return rows;
}

/**
 * Pone (o quita, con null) la extensión de cada persona en el campus. En una
 * transacción: o entran todas o ninguna. Solo personas que ya están en el
 * campus: devuelve los ids que no lo están, para decirlo.
 */
export async function ponerExtensiones(client, projectId, lista) {
  // Primero se vacían las que cambian: así dos personas pueden intercambiarse
  // la extensión en un mismo guardado sin chocar con el índice único.
  const ids = lista.map((x) => x.user_id);
  await client.query(
    `UPDATE user_projects SET zadarma_extension = NULL
      WHERE project_id = $1 AND user_id = ANY($2::int[])`,
    [projectId, ids]
  );
  const fuera = [];
  for (const { user_id: userId, extension } of lista) {
    const r = await client.query(
      `UPDATE user_projects SET zadarma_extension = $3
        WHERE project_id = $1 AND user_id = $2 AND active`,
      [projectId, userId, extension]
    );
    if (!r.rowCount) fuera.push(userId);
  }
  return fuera;
}

// ─── Avisos de Zadarma ──────────────────────────────────────────────────────

/** Quién tiene esta extensión en alguno de estos campus. */
export async function gestoraDeLaExtension(extension, projectIds) {
  if (!extension) return null;
  const { rows } = await query(
    `SELECT up.user_id, up.project_id
       FROM user_projects up
      WHERE up.zadarma_extension = $1 AND up.project_id = ANY($2::int[]) AND up.active
      ORDER BY up.project_id
      LIMIT 1`,
    [String(extension), projectIds]
  );
  return rows[0] ? { userId: Number(rows[0].user_id), projectId: Number(rows[0].project_id) } : null;
}

/**
 * El prospecto de una llamada. Primero, el que pulsó la gestora en las dos
 * horas anteriores al inicio con ese número; si no, el que tiene ese teléfono
 * (los 9 últimos dígitos, el mismo criterio que WhatsApp) en esos campus,
 * prefiriendo uno de la gestora y el más reciente.
 */
export async function leadDeLaLlamada({ cola9, userId, projectIds, inicio, zonaHoraria }) {
  if (userId) {
    const { rows } = await query(
      `SELECT p.lead_id, p.project_id
         FROM llamadas_pedidas p
         JOIN leads l ON l.id = p.lead_id AND l.deleted_at IS NULL
        WHERE p.user_id = $1 AND right(regexp_replace(p.numero, '[^0-9]', '', 'g'), 9) = $2
          AND p.project_id = ANY($3::int[])
          AND p.pedida_at BETWEEN ($4::timestamp AT TIME ZONE $5) - interval '2 hours'
                              AND ($4::timestamp AT TIME ZONE $5) + interval '10 minutes'
        ORDER BY p.pedida_at DESC
        LIMIT 1`,
      [userId, cola9, projectIds, inicio, zonaHoraria]
    );
    if (rows[0]) return { leadId: Number(rows[0].lead_id), projectId: Number(rows[0].project_id) };
  }
  const { rows } = await query(
    `SELECT l.id, l.project_id
       FROM leads l
      WHERE l.deleted_at IS NULL
        AND l.project_id = ANY($1::int[])
        AND COALESCE(l.telefono, '') <> ''
        AND right(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 9) = $2
      ORDER BY (l.responsable_id IS NOT DISTINCT FROM $3) DESC, l.created_at DESC
      LIMIT 1`,
    [projectIds, cola9, userId || null]
  );
  return rows[0] ? { leadId: Number(rows[0].id), projectId: Number(rows[0].project_id) } : null;
}

/**
 * Guarda la llamada. Si ese `pbx_call_id` ya estaba, no hace nada y devuelve
 * null: es el mismo aviso repetido (Zadarma reintenta si no contestamos a
 * tiempo).
 */
export async function guardarLlamada(l) {
  const { rows } = await query(
    `INSERT INTO llamadas (project_id, lead_id, user_id, extension, numero, direccion, inicio,
                           duracion_seg, contestada, estado, grabada, call_id_with_rec, pbx_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, ($7::timestamp AT TIME ZONE $8), $9, $10, $11, $12, $13, $14)
     ON CONFLICT (pbx_call_id) DO NOTHING
     RETURNING id, inicio`,
    [l.projectId, l.leadId, l.userId, l.extension, l.numero, l.direccion, l.inicio, l.zonaHoraria,
     l.duracion, l.contestada, l.estado, l.grabada, l.callIdWithRec, l.pbxCallId]
  );
  return rows[0] || null;
}

export async function enlazarInteraccion(llamadaId, interaccionId) {
  await query('UPDATE llamadas SET interaccion_id = $2 WHERE id = $1', [llamadaId, interaccionId]);
}

// ─── El reporte por gestora (Actividad por comercial, #203) ────────────────

/**
 * Llamadas de Zadarma por gestora y periodo, con el día de Madrid como el resto
 * de «Actividad por comercial». `responsableId`: el alcance de quien pide (una
 * gestora, ella; quien lleva un equipo, ella y su equipo; null, todas). Las
 * llamadas sin gestora (extensión sin dueña) salen en «Sin asignar» solo a
 * quien lo ve todo.
 */
export async function llamadasPorGestora({ projectIds, responsableId, desde, hasta }) {
  const params = [projectIds, desde, hasta];
  let porPersona = '';
  if (responsableId) {
    params.push(comoIds(responsableId));
    porPersona = `AND ll.user_id = ANY($${params.length}::int[])`;
  }
  const { rows } = await query(
    `SELECT ll.user_id, u.nombre AS comercial,
            COUNT(*)::int                                              AS llamadas,
            COUNT(*) FILTER (WHERE ll.direccion = 'saliente')::int     AS salientes,
            COUNT(*) FILTER (WHERE ll.direccion = 'entrante')::int     AS entrantes,
            COUNT(*) FILTER (WHERE ll.contestada)::int                 AS contestadas,
            COUNT(*) FILTER (WHERE NOT ll.contestada)::int             AS no_contestadas,
            COALESCE(SUM(ll.duracion_seg), 0)::int                     AS segundos,
            COUNT(DISTINCT ll.lead_id)::int                            AS personas
       FROM llamadas ll
       LEFT JOIN users u ON u.id = ll.user_id
      WHERE ll.project_id = ANY($1::int[])
        AND (ll.inicio AT TIME ZONE 'Europe/Madrid')::date >= $2::date
        AND (ll.inicio AT TIME ZONE 'Europe/Madrid')::date <= $3::date
        ${porPersona}
      GROUP BY ll.user_id, u.nombre`,
    params
  );
  return rows;
}
