import { logger } from '../shared/utils/logger.js';
import * as model from '../modules/stripe-payments/stripe-payments.model.js';
import { syncStripePayments } from '../modules/stripe-payments/stripe-payments.service.js';

// Sync incremental cada 5 min de los proyectos con Stripe configurado.
const TICK_MS = parseInt(process.env.STRIPE_SYNC_TICK_MS || String(5 * 60 * 1000));
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const projectIds = await model.listProjectsWithStripe();
    for (const pid of projectIds) {
      try {
        const r = await syncStripePayments(pid, { fullHistory: false });
        if (r.imported > 0) logger.info({ projectId: pid, imported: r.imported }, 'Stripe cron sync');
      } catch (err) {
        logger.warn({ projectId: pid, err: err.message }, 'Stripe cron sync error');
      }
    }
  } catch (err) {
    // Faltaba este catch, y no era un detalle: `tick` se pasa a `setTimeout` y a
    // `setInterval`, que no esperan la promesa. Un fallo aqui —un parpadeo de
    // Postgres al pedir los proyectos, por ejemplo— salia como rechazo sin
    // capturar y **mataba el proceso entero**, con el CRM completo dentro.
    //
    // Ya hay red a nivel de proceso en `app.js`, pero eso es el ultimo recurso:
    // un cron que falla tiene que apuntarlo y volver a intentarlo al siguiente
    // turno, no dejar que suba.
    logger.error({ err: err.message }, 'Stripe cron: fallo la vuelta, se reintenta en el siguiente turno');
  } finally { running = false; }
}

export function startStripePaymentsSyncScheduler() {
  setTimeout(tick, 30_000); // primera corrida a los 30s del boot
  setInterval(tick, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'Stripe payments sync scheduler iniciado');
}
