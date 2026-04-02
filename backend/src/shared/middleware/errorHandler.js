import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  if (!err.isOperational) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.code && { code: err.code }),
  });
}
