// Meta Ads API client (CRM-101)
// Contrato definido en docs/03-api-endpoints.md > Meta Ads
// Backend pendiente (modulo `meta-ads` por implementar). Mientras tanto, USE_MOCKS=true.

import client from '@/shared/api/client';
import { metaCampaignsMock } from '../mocks/meta.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * GET /api/meta/campaigns/:projectId
 * @param {string|number} projectId
 * @param {{ fechaDesde?: string, fechaHasta?: string, level?: 'campaign'|'adset'|'ad' }} params
 * @returns {Promise<{ success: boolean, data: MetaCampaign[] }>}
 */
export async function getMetaCampaigns(projectId, params = {}) {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: metaCampaignsMock(projectId, params) };
  }
  const qs = new URLSearchParams(params).toString();
  return client.get(`/meta/campaigns/${projectId}${qs ? '?' + qs : ''}`);
}

/**
 * @typedef {Object} MetaCampaign
 * @property {string} campaignId
 * @property {string} campaignName
 * @property {'ACTIVE'|'PAUSED'|'COMPLETED'} status
 * @property {string} objective
 * @property {{ impressions: number, clicks: number, spend: number, ctr: number, cpc: number, cpm: number }} metrics
 * @property {number} crmLeadCount
 * @property {number} crmConversionCount
 * @property {number} costPerCrmLead
 * @property {number} costPerCrmConversion
 */
