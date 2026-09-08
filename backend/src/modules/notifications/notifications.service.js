import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { claseDe, metaDe, seAgrupa, tiposApagables, ACCION } from './tipos.js';

/**
 * Crear notif para admins/superadmins. Llamar desde otros services (lead.softDelete, etc).
 * No falla nunca: en error solo loggea (la notif es accesoria).
 */
export async function notifyAdmins({ type, title, message = null, link_path = null, metadata = {}, triggered_by_user_id = null }) {
  try {
    const { rows } = await query(
      `INSERT INTO admin_notifications (type, title, message, link_path, metadata, triggered_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, title, created_at`,
      [type, title, message, link_path, metadata, triggered_by_user_id]
    );
    return rows[0];
  } catch (err) {
    logger.warn({ err: err.message, type }, 'notifyAdmins falló (no crítico)');
    return null;
  }
}

/**
 * Crear notif para uno o varios usuarios concretos (no a todos los admins).
 * Útil para recordatorios de leads (al gestor responsable), avisos personales, etc.
 * Si targetUserIds está vacío o es null, equivale a notifyAdmins (broadcast).
 * No falla nunca: solo loggea.
 */
export async function notifyUsers({ targetUserIds, type, title, message = null, link_path = null, metadata = {}, triggered_by_user_id = null }) {
  const targets = Array.isArray(targetUserIds) && targetUserIds.length > 0 ? targetUserIds : null;
  try {
    const { rows } = await query(
      `INSERT INTO admin_notifications (type, title, message, link_path, metadata, triggered_by_user_id, target_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, title, created_at`,
      [type, title, message, link_path, metadata, triggered_by_user_id, targets]
    );
    return rows[0];
  } catch (err) {
    logger.warn({ err: err.message, type, targets }, 'notifyUsers falló (no crítico)');
    return null;
  }
}

// ── Los avisos que alguien ha apagado (#111) ────────────────────────────────
//
// La tabla llega en la migracion 146, que no esta aplicada. Hasta que lo este,
// no se apaga nada y la pantalla de preferencias lo dice — en vez de aceptar
// el clic y perderlo, que es lo que hacia la version de `localStorage`.

let hayTablaDeApagados = null;   // null = sin mirar todavia
let yaAvisadoDeLaTabla = false;

/** Para las pruebas: vuelve a mirar si la tabla existe. */
export function _olvidar() {
  hayTablaDeApagados = null;
  yaAvisadoDeLaTabla = false;
}

async function tablaDeApagados() {
  if (hayTablaDeApagados !== null) return hayTablaDeApagados;
  try {
    const { rows } = await query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notification_mutes'`);
    hayTablaDeApagados = rows.length > 0;
  } catch (err) {
    // Si ni siquiera se puede preguntar, se asume que no esta: mejor enseñar
    // todos los avisos que esconderlos por un fallo de conexion.
    logger.warn({ err: err.message }, 'No se pudo comprobar notification_mutes');
    hayTablaDeApagados = false;
  }
  if (!hayTablaDeApagados && !yaAvisadoDeLaTabla) {
    yaAvisadoDeLaTabla = true;
    logger.warn('Falta la migracion 146 (notification_mutes): no se puede apagar ningun aviso');
  }
  return hayTablaDeApagados;
}

/** Los tipos que este usuario tiene apagados. Lista vacia si no hay tabla. */
async function apagadosDe(userId) {
  if (!(await tablaDeApagados())) return [];
  try {
    const { rows } = await query(
      `SELECT type FROM notification_mutes WHERE user_id = $1`, [userId]);
    return rows.map((r) => r.type);
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'No se pudieron leer los avisos apagados');
    return [];
  }
}

/**
 * Lista notifs visibles para un usuario. Reglas:
 *   - Si la notif tiene target_user_ids populado → solo la ven esos users
 *   - Si target_user_ids es NULL → la ven admins/superadmins (broadcast clásico)
 * Los gestores solo ven las notifs dirigidas a ellos personalmente.
 * unreadOnly=true → solo no leídas.
 */
function visibilityClause(userId, role, paramIdx) {
  // Param posicional: $${paramIdx} debe ser userId
  const isAdminLike = role === 'admin' || role === 'superadmin' || role === 'soporte';
  if (isAdminLike) {
    return `(n.target_user_ids IS NULL OR $${paramIdx} = ANY(n.target_user_ids))`;
  }
  return `(n.target_user_ids IS NOT NULL AND $${paramIdx} = ANY(n.target_user_ids))`;
}

/**
 * Lo repetido, en una fila (#111).
 *
 * Diego tenia 98 sin leer y casi todas eran «Revisión diaria: hay cosas sin
 * atar». Seis dias del mismo aviso son un aviso, no seis.
 *
 * El recuento se hace EN SQL y no despues de traer las filas: con `LIMIT 50`,
 * contar en JavaScript diria «×50» de un grupo de 98. El numero tiene que ser
 * el de verdad o no sirve de nada.
 *
 * Y solo se agrupa lo que dice `tipos.js`. Seis prospectos nuevos NO se
 * agrupan: son seis fichas distintas, cada una con su enlace.
 */
export async function list({ userId, role = 'gestor', unreadOnly = false, limit = 50 } = {}) {
  const agrupables = tiposApagables().map((t) => t.tipo).filter(seAgrupa);
  const apagados = await apagadosDe(userId);

  const condiciones = [visibilityClause(userId, role, 1)];
  if (unreadOnly) condiciones.push(`NOT ($1 = ANY(n.read_by_user_ids))`);
  // Los apagados no se borran, solo se dejan de enseñar: al volver a
  // encenderlos vuelven a estar, con su fecha original.
  if (apagados.length) condiciones.push(`NOT (n.type = ANY($3::text[]))`);

  const params = [userId, limit, ...(apagados.length ? [apagados] : [])];
  const idxAgrupables = params.length + 1;
  params.push(agrupables);

  const { rows } = await query(
    `WITH visibles AS (
       SELECT n.id, n.type, n.title, n.message, n.link_path, n.metadata,
              n.triggered_by_user_id, n.created_at,
              n.read_by_user_ids @> ARRAY[$1::int] AS is_read,
              -- El grupo: el tipo si se agrupa, y si no la propia fila (asi
              -- cada una va por su cuenta sin necesitar una consulta aparte).
              CASE WHEN n.type = ANY($${idxAgrupables}::text[])
                   THEN n.type ELSE 'id:' || n.id END AS grupo
         FROM admin_notifications n
        WHERE ${condiciones.join(' AND ')}
     ),
     contadas AS (
       SELECT v.*,
              COUNT(*)                              OVER (PARTITION BY v.grupo) AS veces,
              COUNT(*) FILTER (WHERE NOT v.is_read) OVER (PARTITION BY v.grupo) AS sin_leer,
              MIN(v.created_at)                     OVER (PARTITION BY v.grupo) AS desde
         FROM visibles v
     ),
     ultima_de_cada_grupo AS (
       SELECT DISTINCT ON (grupo) * FROM contadas ORDER BY grupo, created_at DESC
     )
     SELECT g.id, g.type, g.title, g.message, g.link_path, g.metadata,
            g.triggered_by_user_id, u.nombre AS triggered_by_nombre,
            g.is_read, g.created_at, g.grupo,
            g.veces::int AS veces, g.sin_leer::int AS sin_leer, g.desde
       FROM ultima_de_cada_grupo g
       LEFT JOIN users u ON u.id = g.triggered_by_user_id
      ORDER BY g.created_at DESC
      LIMIT $2`,
    params
  );

  return rows.map((r) => ({
    ...r,
    clase: claseDe(r.type),
    etiqueta: metaDe(r.type).etiqueta,
  }));
}

/**
 * Sin leer, separando lo que hay que hacer de lo que hay que saber (#111).
 *
 * El globo de la campana usa `accion`. Un numero que sube porque hay seis
 * copias del informe diario no dice nada; uno que sube porque hay tres fichas
 * esperando, si.
 */
export async function unreadCount(userId, role = 'gestor') {
  const apagados = await apagadosDe(userId);
  const cond = [visibilityClause(userId, role, 1), `NOT ($1 = ANY(n.read_by_user_ids))`];
  const params = [userId];
  if (apagados.length) { cond.push(`NOT (n.type = ANY($2::text[]))`); params.push(apagados); }

  const { rows } = await query(
    `SELECT n.type, COUNT(*)::int AS c FROM admin_notifications n
      WHERE ${cond.join(' AND ')} GROUP BY n.type`, params);

  let accion = 0; let aviso = 0;
  for (const r of rows) {
    if (claseDe(r.type) === ACCION) accion += r.c; else aviso += r.c;
  }
  return { total: accion + aviso, accion, aviso };
}

export async function markRead(notifId, userId) {
  const { rowCount } = await query(
    `UPDATE admin_notifications
     SET read_by_user_ids = array_append(read_by_user_ids, $2)
     WHERE id = $1 AND NOT ($2 = ANY(read_by_user_ids))`,
    [notifId, userId]
  );
  if (rowCount === 0) {
    // Ya estaba marcada o no existe; idempotente.
    const { rows } = await query(`SELECT id FROM admin_notifications WHERE id = $1`, [notifId]);
    if (!rows[0]) throw new AppError('Notificación no encontrada', 404, 'NOT_FOUND');
  }
  return { id: notifId, read: true };
}

/**
 * Marca leída una fila agrupada ENTERA.
 *
 * Si la campana enseña «Revisión diaria ×98» y al pulsarla solo se marca la
 * ultima, quedan 97 y el globo no baja: la agrupacion seria un maquillaje.
 *
 * El grupo llega como lo devuelve `list()`: `'id:123'` para una suelta, o el
 * nombre del tipo para las que se agrupan. No se aceptan ids sueltos en el
 * cuerpo para no marcar por error avisos que este usuario ni ve — el filtro de
 * visibilidad se vuelve a aplicar aqui.
 */
export async function markReadGroup(grupo, userId, role = 'gestor') {
  if (typeof grupo !== 'string' || !grupo) {
    throw new AppError('Grupo requerido', 400, 'INVALID_GROUP');
  }
  if (grupo.startsWith('id:')) {
    const id = parseInt(grupo.slice(3), 10);
    if (!Number.isInteger(id)) throw new AppError('Grupo inválido', 400, 'INVALID_GROUP');
    await markRead(id, userId);
    return { marked: 1 };
  }
  const { rowCount } = await query(
    `UPDATE admin_notifications n
        SET read_by_user_ids = array_append(n.read_by_user_ids, $1)
      WHERE n.type = $2
        AND NOT ($1 = ANY(n.read_by_user_ids))
        AND ${visibilityClause(userId, role, 1)}`,
    [userId, grupo]
  );
  return { marked: rowCount };
}

export async function markAllRead(userId) {
  const { rowCount } = await query(
    `UPDATE admin_notifications
     SET read_by_user_ids = array_append(read_by_user_ids, $1)
     WHERE NOT ($1 = ANY(read_by_user_ids))`,
    [userId]
  );
  return { marked: rowCount };
}

// ── Preferencias: que avisos quiere cada quien (#111) ───────────────────────

/**
 * Los tipos que hay, cuales tiene apagados esta persona, y si se puede guardar.
 *
 * `guardable: false` cuando falta la migracion 146. La pantalla lo dice en vez
 * de aceptar el clic y perderlo.
 */
export async function preferencias(userId) {
  const disponible = await tablaDeApagados();
  return {
    tipos: tiposApagables(),
    apagados: await apagadosDe(userId),
    guardable: disponible,
    aviso: disponible ? null
      : 'Falta aplicar la migración 146 (notification_mutes): de momento no se puede apagar ningún aviso.',
  };
}

/** Deja apagados exactamente los tipos que se pasan. Lo que no venga, encendido. */
export async function guardarPreferencias(userId, apagados) {
  if (!Array.isArray(apagados)) throw new AppError('Lista de tipos requerida', 400, 'INVALID_BODY');
  if (!(await tablaDeApagados())) {
    throw new AppError(
      'Todavía no se pueden apagar avisos: falta aplicar la migración 146.',
      503, 'MIGRATION_PENDING');
  }
  // Solo tipos conocidos: un `type` cualquiera en la tabla no apagaria nada y
  // se quedaria ahi para siempre confundiendo a quien mire.
  const conocidos = new Set(tiposApagables().map((t) => t.tipo));
  const limpios = [...new Set(apagados.filter((t) => conocidos.has(t)))];

  await query('BEGIN');
  try {
    await query(`DELETE FROM notification_mutes WHERE user_id = $1`, [userId]);
    if (limpios.length) {
      await query(
        `INSERT INTO notification_mutes (user_id, type)
         SELECT $1, UNNEST($2::text[])`, [userId, limpios]);
    }
    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
  return { apagados: limpios };
}
