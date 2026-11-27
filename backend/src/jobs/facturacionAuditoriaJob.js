import { logger } from '../shared/utils/logger.js';
import { vigilar } from './latido.js';
import { leerConfigConDb, CADA_MS } from '../modules/facturacion-auditoria/facturacion-auditoria.config.js';
import { auditar } from '../modules/facturacion-auditoria/facturacion-auditoria.service.js';

/**
 * La auditoría de facturación, cada 2 horas (#765, Automatizaciones 2/9).
 *
 * Apagada de serie: FACTURACION_AUDITORIA_ACTIVA=true para encenderla. Se
 * vuelve a mirar el interruptor en cada vuelta, así que apagarlo en el .env la
 * para en la siguiente sin reiniciar (encenderla sí pide reiniciar).
 */

const AL_ARRANCAR_MS = 5 * 60 * 1000;

export async function runFacturacionAuditoria({ cfg } = {}) {
  const config = cfg || await leerConfigConDb();
  if (!config.activa) return { omitido: 'apagada' };
  const r = await auditar({ origen: 'programada', cfg: config });
  return { limpia: r.limpia, ...r.resumen, pausada: !!r.pausa };
}

export function startFacturacionAuditoriaScheduler() {
  // #1202: igual que en factura-automatica, siempre se arranca; runFacturacionAuditoria()
  // ya vuelve a mirar el interruptor en cada vuelta y no hace nada si esta apagado.
  logger.info('Auditoría de facturación: vigilante arrancado (el interruptor se mira en cada vuelta)');
  return vigilar('facturacion_auditoria', 'Auditoría de facturación (cada 2 horas)',
    () => runFacturacionAuditoria(), CADA_MS, { alArrancarMs: AL_ARRANCAR_MS });
}
