// Google Ads API client (CRM-104)
// Contrato definido en docs/03-api-endpoints.md > Google Ads + extension cross-CRM (ver Claude/features/CRM-104.md)
// Backend pendiente (modulo `google-ads` por implementar). Mientras tanto, USE_MOCKS=true.

import client from '@/shared/api/client';
import { googleCampaignsMock } from '../mocks/google.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * GET /api/google/campaigns/:projectId
 * @param {string|number} projectId
 * @param {{ fechaDesde?: string, fechaHasta?: string }} params
 * @returns {Promise<{ success: boolean, data: { campaigns: GoogleCampaign[], keywords: GoogleKeyword[] } }>}
 */
export async function getGoogleCampaigns(projectId, params = {}) {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: googleCampaignsMock(projectId, params) };
  }
  const qs = new URLSearchParams(params).toString();
  return client.get(`/google/campaigns/${projectId}${qs ? '?' + qs : ''}`);
}

/**
 * @typedef {Object} GoogleCampaign
 * @property {string} campaignId
 * @property {string} campaignName
 * @property {'ENABLED'|'PAUSED'|'REMOVED'} status
 * @property {'SEARCH'|'DISPLAY'|'VIDEO'|'SHOPPING'|'PERFORMANCE_MAX'} type
 * @property {{ impressions: number, clicks: number, spend: number, ctr: number, cpc: number, conversions: number, conversionRate: number }} metrics
 * @property {number} crmLeadCount   // extension CRM-104: leads CRM cruzados por UTM
 * @property {number} crmConversionCount
 * @property {number} costPerCrmLead
 * @property {number} costPerCrmConversion
 */

/**
 * @typedef {Object} GoogleKeyword
 * @property {string} keyword
 * @property {'EXACT'|'PHRASE'|'BROAD'} matchType
 * @property {number} impressions
 * @property {number} clicks
 * @property {number} spend
 * @property {number} ctr
 * @property {number} cpc
 * @property {number} qualityScore
 */
