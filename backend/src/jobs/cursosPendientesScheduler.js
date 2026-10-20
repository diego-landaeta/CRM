import { logger } from '../shared/utils/logger.js';
import { avisarVencimientos } from '../modules/cursos-pendientes/cursos-pendientes.service.js';
import { vigilar } from './latido.js';

/**
 * Los avisos por fecha de «Cursos pendientes» (#336).
 *
 * A 3 días de la fecha comprometida, el día que se pasa, más de 48 h sin tutora y
 * publicado con alumnas sin habilitar más de 48 h. El job solo llama a
 * `avisarVencimientos`, que manda cada aviso UNA sola vez por curso y fecha (la
 * tabla `cursos_pendientes_avisos` lo recuerda): repetir la vuelta cada hora no
 * repite nada, y reiniciar la aplicación tampoco.
 */

const TICK_MS = parseInt(process.env.CURSOS_PENDIENTES_TICK_MS || String(60 * 60 * 1000), 10);

async function vuelta() {
  try {
    await avisarVencimientos();
  } catch (err) {
    logger.error({ err: err.message }, 'Fallo en los avisos de cursos pendientes');
  }
}

export function startCursosPendientesScheduler() {
  if (process.env.CURSOS_PENDIENTES_DISABLED === '1') {
    logger.info('Avisos de cursos pendientes desactivados (CURSOS_PENDIENTES_DISABLED=1)');
    return;
  }
  vigilar('cursos_pendientes', 'Avisos de cursos pendientes', vuelta, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'Avisos de cursos pendientes iniciados');
}

export const _internos = { vuelta };
