import crypto from 'node:crypto';
import { saveLocal, getLocal } from '../../shared/services/localStorage.service.js';
import { logger } from '../../shared/utils/logger.js';
import * as evolution from './evolution.client.js';

// Los adjuntos de WhatsApp.
//
// WhatsApp NO da una URL publica de los ficheros: viajan cifrados y solo se
// pueden pedir a traves de Evolution, que los descifra. Por eso hay que
// bajarlos en cuanto llegan y guardarlos nosotros — si se deja para cuando la
// gestora abra el chat, puede que ya no esten.

const EXTENSIONES = {
  'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a', 'audio/amr': 'amr', 'audio/wav': 'wav',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'application/pdf': 'pdf',
};

const extensionDe = (mime, nombreArchivo) => {
  const limpio = String(mime || '').split(';')[0].trim();
  if (EXTENSIONES[limpio]) return EXTENSIONES[limpio];
  const delNombre = String(nombreArchivo || '').split('.').pop();
  return delNombre && delNombre.length <= 5 ? delNombre.toLowerCase() : 'bin';
};

/** Del tipo de mensaje de WhatsApp al tipo que guardamos. */
export function tipoDeMensaje(message) {
  if (!message) return { tipo: 'texto', clave: null };
  if (message.audioMessage) return { tipo: 'audio', clave: 'audioMessage' };
  if (message.imageMessage) return { tipo: 'imagen', clave: 'imageMessage' };
  if (message.videoMessage) return { tipo: 'video', clave: 'videoMessage' };
  if (message.documentMessage) return { tipo: 'documento', clave: 'documentMessage' };
  if (message.stickerMessage) return { tipo: 'sticker', clave: 'stickerMessage' };
  if (message.conversation || message.extendedTextMessage) return { tipo: 'texto', clave: null };
  return { tipo: 'otro', clave: null };
}

/** El texto que acompaña al adjunto, si lo hay. */
export const textoDe = (m = {}) =>
  m.conversation
  || m.extendedTextMessage?.text
  || m.imageMessage?.caption
  || m.videoMessage?.caption
  || m.documentMessage?.caption
  || null;

/**
 * Baja un adjunto entrante y lo deja en disco. Devuelve la clave con la que
 * luego se sirve, o null si no se pudo.
 *
 * Nunca lanza: que falle la descarga de una foto no puede hacer que se pierda
 * el mensaje entero. Se guarda el mensaje con su tipo y sin fichero, y en el
 * chat sale como «no se pudo descargar».
 */
export async function bajarYGuardar({ key, message, instancia }) {
  const { tipo, clave } = tipoDeMensaje(message);
  if (!clave) return null;
  try {
    const r = await evolution.bajarMedia(key, instancia);
    if (!r.ok || !r.base64) {
      logger.warn({ waId: key?.id, tipo }, 'WhatsApp: no se pudo bajar el adjunto');
      return null;
    }
    const mime = r.mimetype || message[clave]?.mimetype || 'application/octet-stream';
    const ext = extensionDe(mime, r.fileName);
    // Nombre imprevisible a proposito: el fichero se sirve por un endpoint con
    // sesion, pero si algun dia se expone la carpeta, que no se pueda adivinar.
    const nombre = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const ruta = `whatsapp/${instancia}/${nombre}`;
    await saveLocal(ruta, Buffer.from(r.base64, 'base64'));
    return {
      ruta,
      mime,
      tipo,
      nombreArchivo: r.fileName || nombre,
      tamano: Number(r.size?.fileLength || r.size || 0) || null,
    };
  } catch (err) {
    logger.error({ err: err.message, waId: key?.id }, 'WhatsApp: fallo bajando el adjunto');
    return null;
  }
}

/** Lee un adjunto ya guardado, para servirlo. */
export async function leer(ruta) {
  const { buffer, size } = await getLocal(ruta);
  return { buffer, size };
}
