import { query } from '../../shared/config/db.js';
import { normalizePhone, phoneCanonical } from '../../shared/utils/normalizePhone.js';

// Las conversaciones de WhatsApp. Antes esto no existia: se veian en el
// navegador remoto y se perdian. Ahora viven aqui, y por eso se pueden buscar,
// ver en la ficha del lead y contar.

/** De 5511999999999@s.whatsapp.net saca el numero. */
export const jidATelefono = (jid) => normalizePhone(String(jid || '').split('@')[0]);

/**
 * Busca el lead que tenga ese telefono. Compara con phoneCanonical, que es lo
 * que ya usa el CRM para deduplicar: asi un +5215512345678 y un +525512345678
 * —el mismo movil mexicano con y sin el 1— se reconocen como la misma persona.
 */
export async function leadPorTelefono(telefono, projectId = null) {
  const canonico = phoneCanonical(telefono);
  if (!canonico) return null;

  // Se comparan los ULTIMOS 9 digitos, no el numero entero. Los leads
  // importados de Excel vienen muchas veces sin prefijo de pais («600123456»)
  // mientras que WhatsApp siempre lo manda («+34600123456»): comparar completo
  // no casaria ninguno de esos, que son justo los 1.664 de Psiko.
  //
  // Nueve digitos es la parte nacional en España, Mexico, Colombia, Argentina y
  // Venezuela. Con menos habria falsos positivos.
  const cola = canonico.replace(/[^0-9]/g, '').slice(-9);
  if (cola.length < 9) return null;

  const params = [cola];
  let filtro = '';
  if (projectId) { params.push(projectId); filtro = `AND l.project_id = $2`; }

  const { rows } = await query(
    `SELECT l.id, l.project_id, l.nombre
       FROM leads l
      WHERE l.deleted_at IS NULL
        AND COALESCE(l.telefono, '') <> ''
        AND right(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 9) = $1
        ${filtro}
      ORDER BY l.created_at DESC
      LIMIT 1`,
    params
  );
  return rows[0] || null;
}

/** La conversacion de este numero, creandola si es la primera vez. */
export async function conversacionDe({ instancia, jid, nombrePush }) {
  const telefono = jidATelefono(jid) || jid;
  const lead = await leadPorTelefono(telefono);

  const { rows } = await query(
    `INSERT INTO wa_conversaciones (instancia, jid, telefono, nombre_push, lead_id, project_id, ultimo_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (instancia, jid) DO UPDATE
       SET nombre_push = COALESCE(EXCLUDED.nombre_push, wa_conversaciones.nombre_push),
           -- Si el lead aparece despues (se creo el prospecto mas tarde), se
           -- ata solo. Pero nunca se desata uno ya atado.
           lead_id     = COALESCE(wa_conversaciones.lead_id, EXCLUDED.lead_id),
           project_id  = COALESCE(wa_conversaciones.project_id, EXCLUDED.project_id),
           ultimo_at   = NOW()
     RETURNING *`,
    [instancia, jid, telefono, nombrePush || null, lead?.id || null, lead?.project_id || null]
  );
  return rows[0];
}

/**
 * Guarda un mensaje. Si ya estaba (mismo wa_id) no hace nada y devuelve null:
 * Evolution reintenta el webhook cuando el CRM tarda en contestar, y sin esto
 * el mismo mensaje saldria dos veces en el chat.
 */
export async function guardarMensaje({ conversacionId, waId, direccion, tipo, texto, mediaUrl, mediaMime, nombreArchivo, estado, enviadoPor, ts }) {
  const { rows } = await query(
    `INSERT INTO wa_mensajes
       (conversacion_id, wa_id, direccion, tipo, texto, media_url, media_mime, nombre_archivo, estado, enviado_por, ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (wa_id) WHERE wa_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [conversacionId, waId || null, direccion, tipo || 'texto', texto || null,
     mediaUrl || null, mediaMime || null, nombreArchivo || null, estado || null,
     enviadoPor || null, ts || new Date()]
  );
  const fila = rows[0] || null;
  if (fila) {
    await query(
      `UPDATE wa_conversaciones
          SET ultimo_at = GREATEST(COALESCE(ultimo_at, $2), $2),
              no_leidos = CASE WHEN $3 = 'entrante' THEN no_leidos + 1 ELSE no_leidos END
        WHERE id = $1`,
      [conversacionId, fila.ts, direccion]
    );
  }
  return fila;
}

export async function listar({ instancia, projectId = null, limite = 50 }) {
  const params = [instancia];
  let filtro = '';
  if (projectId) { params.push(projectId); filtro = `AND (c.project_id = $${params.length} OR c.project_id IS NULL)`; }
  params.push(Math.min(200, limite));
  const { rows } = await query(
    `SELECT c.*, l.nombre AS lead_nombre, l.status AS lead_status,
            (SELECT m.texto FROM wa_mensajes m
              WHERE m.conversacion_id = c.id ORDER BY m.ts DESC LIMIT 1) AS ultimo_texto
       FROM wa_conversaciones c
       LEFT JOIN leads l ON l.id = c.lead_id
      WHERE c.instancia = $1 ${filtro}
      ORDER BY c.ultimo_at DESC NULLS LAST
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function mensajes(conversacionId, limite = 100) {
  const { rows } = await query(
    `SELECT id, wa_id, direccion, tipo, texto, media_url, media_mime, nombre_archivo,
            estado, enviado_por, ts
       FROM wa_mensajes WHERE conversacion_id = $1
      -- Se desempata por id porque WhatsApp da la hora en SEGUNDOS: tres
      -- mensajes seguidos comparten marca y sin esto salen en cualquier orden.
      ORDER BY ts DESC, id DESC LIMIT $2`,
    [conversacionId, Math.min(500, limite)]
  );
  return rows.reverse();
}

export const porId = async (id) =>
  (await query('SELECT * FROM wa_conversaciones WHERE id = $1', [id])).rows[0] || null;

export const marcarLeida = (id) =>
  query('UPDATE wa_conversaciones SET no_leidos = 0 WHERE id = $1', [id]);

/** «No me escribas mas». A partir de aqui el CRM se niega a enviar. */
export const noEscribir = (id, motivo) =>
  query('UPDATE wa_conversaciones SET no_escribir = TRUE, motivo_no_escribir = $2 WHERE id = $1', [id, motivo || null]);

/** Cuantos mensajes se han mandado desde esta instancia en los ultimos N minutos. */
export async function salientesRecientes(instancia, minutos) {
  const { rows } = await query(
    `SELECT COUNT(*)::int n
       FROM wa_mensajes m
       JOIN wa_conversaciones c ON c.id = m.conversacion_id
      WHERE c.instancia = $1 AND m.direccion = 'saliente'
        AND m.ts > NOW() - ($2 || ' minutes')::interval`,
    [instancia, String(minutos)]
  );
  return rows[0].n;
}

/**
 * El acuse de WhatsApp. Solo avanza: si ya esta «leido» no vuelve a «entregado»
 * porque los acuses pueden llegar desordenados.
 */
export async function actualizarEstado(waId, estado) {
  const orden = { enviado: 1, entregado: 2, leido: 3, fallido: 9 };
  await query(
    `UPDATE wa_mensajes SET estado = $2
      WHERE wa_id = $1
        AND direccion = 'saliente'
        AND COALESCE(CASE estado WHEN 'enviado' THEN 1 WHEN 'entregado' THEN 2
                                 WHEN 'leido' THEN 3 WHEN 'fallido' THEN 9 ELSE 0 END, 0) < $3`,
    [waId, estado, orden[estado] || 0]
  );
}

/** El ultimo entrante, para decirle a WhatsApp que ya se leyo. */
export async function ultimoEntranteSinLeer(conversacionId) {
  const { rows } = await query(
    `SELECT wa_id FROM wa_mensajes
      WHERE conversacion_id = $1 AND direccion = 'entrante' AND wa_id IS NOT NULL
      ORDER BY ts DESC LIMIT 1`,
    [conversacionId]
  );
  return rows[0] || null;
}

/** Un mensaje con su conversacion, para servir el adjunto comprobando permisos. */
export async function mensajeConAdjunto(id) {
  const { rows } = await query(
    `SELECT m.id, m.media_url, m.media_mime, m.nombre_archivo, c.project_id
       FROM wa_mensajes m JOIN wa_conversaciones c ON c.id = m.conversacion_id
      WHERE m.id = $1 AND m.media_url IS NOT NULL`,
    [id]
  );
  return rows[0] || null;
}

export const leadPorId = async (id) =>
  (await query('SELECT id, nombre, telefono, project_id FROM leads WHERE id = $1 AND deleted_at IS NULL', [id])).rows[0] || null;
