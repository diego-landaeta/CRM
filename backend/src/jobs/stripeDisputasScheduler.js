import { logger } from '../shared/utils/logger.js';
import { vigilar } from './latido.js';
import { vuelta } from '../modules/stripe-payments/disputas.service.js';

/**
 * Disputas de Stripe (#396): cada 30 minutos, las de todas las cuentas
 * conectadas y el segundo aviso de las que vencen sin respuesta.
 *
 * Hace falta aunque haya webhook: el webhook trae la disputa al momento, pero
 * hoy ninguna cuenta lo tiene configurado, y el sondeo de cobros no ve las
 * disputas (solo pide los cargos nuevos). Solo lee de Stripe.
 *
 * Se apaga con STRIPE_DISPUTAS_DISABLED=1. Cada cuanto: STRIPE_DISPUTAS_TICK_MS.
 */
const TICK_MS = parseInt(process.env.STRIPE_DISPUTAS_TICK_MS || String(30 * 60 * 1000), 10);

export function startStripeDisputasScheduler() {
  if (process.env.STRIPE_DISPUTAS_DISABLED === '1') {
    logger.info('Disputas de Stripe: sondeo desactivado (STRIPE_DISPUTAS_DISABLED=1)');
    return;
  }
  // La primera vuelta a los 2 minutos: detras del sondeo de cobros, que arranca a los 30 s.
  vigilar('stripe_disputas', 'Disputas de Stripe: traerlas y avisar', () => vuelta(), TICK_MS,
    { alArrancarMs: 2 * 60 * 1000 });
  logger.info({ tickMs: TICK_MS }, 'Disputas de Stripe: sondeo iniciado');
}
