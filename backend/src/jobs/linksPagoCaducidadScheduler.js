import { logger } from '../shared/utils/logger.js';
import { vigilar } from './latido.js';
import { caducarVencidos } from '../modules/links-pago/links-pago.service.js';

/**
 * Links de pago (#680, fase 2): cada 15 minutos, los links sin pagar cuya fecha
 * de caducidad ya ha pasado se desactivan en Stripe y se marcan «caducado».
 *
 * Un Payment Link de Stripe no caduca solo: si este trabajo no lo desactiva, el
 * cliente lo puede pagar aunque la ficha diga otra cosa. Por eso, si Stripe no
 * contesta, el link se deja vivo y se reintenta en la vuelta siguiente.
 *
 * Solo arranca con los links de pago encendidos (LINKS_PAGO_EN_PRODUCCION, como
 * el módulo). Se puede apagar aparte con LINKS_PAGO_CADUCIDAD_DISABLED=1.
 */
const TICK_MS = 15 * 60 * 1000;

export function startLinksPagoCaducidadScheduler() {
  if (process.env.LINKS_PAGO_CADUCIDAD_DISABLED === '1') {
    logger.info('Links de pago: caducidad desactivada (LINKS_PAGO_CADUCIDAD_DISABLED=1)');
    return;
  }
  vigilar('links_pago_caducidad', 'Links de pago: desactivar los caducados', () => caducarVencidos(), TICK_MS,
    { alArrancarMs: 2 * 60 * 1000 });
  logger.info({ tickMs: TICK_MS }, 'Links de pago: caducidad iniciada');
}
