// Stripe Monitor API client (CRM-108)
// Contrato definido en docs/03-api-endpoints.md > Stripe Monitor
// Backend pendiente (modulo `ia-monitor` por implementar). Mientras tanto, USE_MOCKS=true.

import client from '@/shared/api/client';
import { stripeMetricsMock } from '../mocks/stripe.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * GET /api/ia/metrics/:projectId
 * @param {string|number} projectId
 * @returns {Promise<{ success, data: StripeMetrics }>}
 */
export async function getStripeMetrics(projectId) {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: stripeMetricsMock(projectId) };
  }
  return client.get(`/ia/metrics/${projectId}`);
}

/**
 * @typedef {Object} StripeMetrics
 * @property {number} mrr
 * @property {number} activeSubs
 * @property {number} newSubs
 * @property {number} cancelledSubs
 * @property {number} failedPayments
 * @property {number} churnRate
 * @property {{ mes: string, mrr: number, activeSubs: number, newSubs: number, cancelledSubs: number, churnRate: number }[]} evolution12Months
 */
