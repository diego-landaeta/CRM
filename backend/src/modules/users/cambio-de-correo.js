import crypto from 'crypto';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { logActivity } from '../auth/auth.model.js';
import { sendCodigoCambioCorreoEmail } from '../../shared/services/brevo.service.js';
import * as userModel from './user.model.js';
import { cambiarCorreo } from './user.service.js';

/*
  CAMBIAR EL CORREO CON UN CÓDIGO (#211, Diego 02/10).

  El correo es la credencial y hoy se cambia sin comprobar nada: así 39 de 45
  tutores de ISEIE se quedaron con direcciones que no existían. Ahora va en dos
  pasos:

    1. `pedirCodigo`: el CRM manda un código de 6 cifras a la dirección NUEVA.
       Caduca a los 15 minutos. Una petición nueva anula la anterior.
    2. `confirmarCodigo`: con el código bueno, el correo cambia con
       `cambiarCorreo`, que cierra las sesiones, avisa a la dirección vieja y lo
       anota en el registro (#246, #248). Como mucho 5 intentos: al quinto
       fallo la petición se anula y hay que pedir otro código.

  Solo se guarda el hash del código. El registro dice quién lo pidió, de qué
  correo a cuál, y cuándo se confirmó.

  QUIÉN PUEDE PEDIRLO, Y SI EL FRENO DE TUTORES DEJA MANDAR EL CÓDIGO, ESTÁ
  PENDIENTE DE DIEGO (#211, 05/11): aquí solo está el mecanismo.
*/

export const MINUTOS = 15;
export const INTENTOS = 5;

const hash = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');
const anotar = (porUserId, action, details, ip) => (porUserId
  ? logActivity(porUserId, action, details, ip || null).catch((err) => logger.error({ err: err.message, action }, 'No se pudo anotar en el registro'))
  : null);

/** Seis cifras, con ceros a la izquierda y de un generador seguro. */
export function nuevoCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Manda el código a la dirección nueva. No cambia nada todavía.
 * @returns {{ email: string, expira_at: Date, enviado: boolean }}
 */
export async function pedirCodigo({ userId, emailNuevo, porUserId = userId, ip = null, enviar = sendCodigoCambioCorreoEmail }) {
  const nuevo = String(emailNuevo || '').trim().toLowerCase();
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Usuario no encontrado', 404, 'NOT_FOUND');
  if (String(user.email).toLowerCase() === nuevo) throw new AppError('Ese ya es tu correo', 400, 'MISMO_CORREO');
  const otro = await userModel.findByEmail(nuevo);
  if (otro && otro.id !== userId) throw new AppError('Ese correo ya lo usa otro usuario', 409, 'EMAIL_EXISTS');

  const codigo = nuevoCodigo();
  const expira = new Date(Date.now() + MINUTOS * 60_000);
  // Solo vale el último: la petición pendiente que hubiera se anula.
  await query(`UPDATE cambios_de_correo SET anulado_at = NOW()
                WHERE user_id = $1 AND confirmado_at IS NULL AND anulado_at IS NULL`, [userId]);
  await query(`INSERT INTO cambios_de_correo (user_id, email_nuevo, codigo_hash, expira_at, pedido_por_user_id)
               VALUES ($1, $2, $3, $4, $5)`, [userId, nuevo, hash(codigo), expira, porUserId]);
  await anotar(porUserId, 'usuario.pedir_cambio_correo', { usuario_id: userId, de: user.email, a: nuevo }, ip);

  const r = await enviar({ nombre: user.nombre, a: nuevo, codigo, minutos: MINUTOS })
    .catch((err) => { logger.error({ err: err.message, userId }, 'No se pudo mandar el código de cambio de correo'); return { sent: false }; });
  return { email: nuevo, expira_at: expira, enviado: Boolean(r?.sent) };
}

/**
 * Con el código bueno, cambia el correo. Cada intento cuenta; al quinto fallo,
 * la petición se anula.
 *
 * Revisión de Diego (#688, 05/11):
 *   - El intento se cuenta ANTES de comparar y en una sola sentencia
 *     (`intentos = intentos + 1 … WHERE intentos < 5`). Si se leía, se
 *     comparaba y luego se escribía, varias peticiones a la vez leían
 *     `intentos = 0` y cada una probaba un código: el límite de 5 no valía.
 *   - Con el bueno, la petición se marca confirmada ANTES de cambiar el
 *     correo, y solo si seguía viva: así no se puede usar dos veces. Si el
 *     cambio falla (p. ej. el correo ya lo ha cogido otra persona), la
 *     petición se anula: no queda viva con el correo sin cambiar.
 */
export async function confirmarCodigo({ userId, codigo, porUserId = userId, ip = null }) {
  const { rows: [p] } = await query(
    `UPDATE cambios_de_correo SET intentos = intentos + 1
      WHERE user_id = $1 AND confirmado_at IS NULL AND anulado_at IS NULL AND intentos < $2
      RETURNING id, intentos, codigo_hash, expira_at, email_nuevo`, [userId, INTENTOS]);
  if (!p) {
    // Viva pero sin intentos: se anula y se dice. Si no, es que no hay ninguna.
    const { rows: [agotada] } = await query(
      `UPDATE cambios_de_correo SET anulado_at = NOW()
        WHERE user_id = $1 AND confirmado_at IS NULL AND anulado_at IS NULL RETURNING id`, [userId]);
    if (agotada) throw new AppError('Demasiados intentos. Pide un código nuevo.', 429, 'DEMASIADOS_INTENTOS');
    throw new AppError('No hay ningún cambio de correo pendiente. Pide un código nuevo.', 400, 'SIN_CODIGO');
  }
  if (new Date(p.expira_at) < new Date()) {
    await query('UPDATE cambios_de_correo SET anulado_at = NOW() WHERE id = $1', [p.id]);
    throw new AppError('El código ha caducado. Pide uno nuevo.', 400, 'CODIGO_CADUCADO');
  }
  const bueno = crypto.timingSafeEqual(Buffer.from(p.codigo_hash), Buffer.from(hash(String(codigo || '').trim())));
  if (!bueno) {
    if (p.intentos >= INTENTOS) {
      await query('UPDATE cambios_de_correo SET anulado_at = NOW() WHERE id = $1', [p.id]);
      throw new AppError('Demasiados intentos. Pide un código nuevo.', 429, 'DEMASIADOS_INTENTOS');
    }
    throw new AppError(`Código incorrecto. Te quedan ${INTENTOS - p.intentos}.`, 400, 'CODIGO_INCORRECTO');
  }

  // Se reclama la petición: solo una confirmación puede ganarla.
  const { rows: [mia] } = await query(
    `UPDATE cambios_de_correo SET confirmado_at = NOW()
      WHERE id = $1 AND confirmado_at IS NULL AND anulado_at IS NULL RETURNING id`, [p.id]);
  if (!mia) throw new AppError('No hay ningún cambio de correo pendiente. Pide un código nuevo.', 400, 'SIN_CODIGO');

  // El cambio de verdad, con todo lo que ya hacía (sesiones, aviso, registro).
  let r;
  try {
    r = await cambiarCorreo(userId, p.email_nuevo, { porUserId, ip });
  } catch (err) {
    await query('UPDATE cambios_de_correo SET confirmado_at = NULL, anulado_at = NOW() WHERE id = $1', [p.id])
      .catch((e) => logger.error({ err: e.message, id: p.id }, 'No se pudo anular la petición de cambio de correo'));
    throw err;
  }
  await anotar(porUserId, 'usuario.confirmar_cambio_correo', { usuario_id: userId, a: p.email_nuevo }, ip);
  return r;
}
