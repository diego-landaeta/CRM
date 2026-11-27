import { query } from '../../shared/config/db.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Quién cambia los ajustes de facturación automática desde la pantalla (#1202).
 *
 * Mismo sitio que credentials.registro.js: `user_activity_log` ya existe. Se
 * anota QUÉ campo se tocó (y de qué campus, si aplica) y quién — nunca el
 * valor nuevo ni el viejo.
 */

export const ACCIONES = {
  GLOBAL: 'ajuste_facturacion.global',
  CAMPUS: 'ajuste_facturacion.campus',
};

export async function anotar(req, accion, { campos = [], projectId = null } = {}) {
  try {
    await query(
      `INSERT INTO user_activity_log (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user?.userId || null,
        accion,
        JSON.stringify({ campos, project_id: projectId }),
        req.ip || req.headers['x-forwarded-for'] || null,
      ]
    );
  } catch (err) {
    logger.error(
      { err: err.message, accion, userId: req.user?.userId },
      'Ajustes de facturación: NO se pudo anotar el cambio'
    );
  }
}

export async function historial({ limite = 100 } = {}) {
  const { rows } = await query(
    `SELECT l.id, l.action, l.details, l.created_at,
            u.nombre AS usuario, u.email AS usuario_email
       FROM user_activity_log l
       LEFT JOIN users u ON u.id = l.user_id
      WHERE l.action LIKE 'ajuste_facturacion.%'
      ORDER BY l.created_at DESC
      LIMIT $1`,
    [Math.min(Number(limite) || 100, 500)]
  );
  return rows;
}