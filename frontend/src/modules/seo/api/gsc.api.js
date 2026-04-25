// Google Search Console API client (CRM-106)
// Contrato definido en docs/03-api-endpoints.md > Google Search Console
// Backend pendiente (modulo `gsc` por implementar). Mientras tanto, USE_MOCKS=true.

import client from '@/shared/api/client';
import { gscMetricsMock, gscConsolidatedMock } from '../mocks/gsc.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * GET /api/gsc/metrics/:projectId
 * @param {string|number} projectId
 * @param {{ fechaDesde?: string, fechaHasta?: string, dimension?: 'query'|'page'|'device' }} params
 * @returns {Promise<{ success, data: { totals, rows, lastUpdate } }>}
 */
export async function getGscMetrics(projectId, params = {}) {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: gscMetricsMock(projectId, params) };
  }
  const qs = new URLSearchParams(params).toString();
  return client.get(`/gsc/metrics/${projectId}${qs ? '?' + qs : ''}`);
}

/**
 * GET /api/gsc/consolidated/:projectId
 * Datos mensuales: organic + paid + leads.
 * @param {string|number} projectId
 * @returns {Promise<{ success, data: { months: ConsolidatedMonth[] } }>}
 */
export async function getGscConsolidated(projectId) {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: gscConsolidatedMock(projectId) };
  }
  return client.get(`/gsc/consolidated/${projectId}`);
}
