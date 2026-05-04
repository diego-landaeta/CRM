import { logger } from '../utils/logger.js';
import { logError } from '../../modules/status/status.model.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  if (!err.isOperational) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }

  // Guardar errores 5xx en status_errors para el panel de soporte
  if (statusCode >= 500) {
    logError({
      method: req.method,
      path: req.path,
      status_code: statusCode,
      message: err.message,
      stack: err.stack,
      user_id: req.user?.userId || null,
    }).catch(() => {}); // silencioso — no bloquear la respuesta
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.code && { code: err.code }),
  });
}
