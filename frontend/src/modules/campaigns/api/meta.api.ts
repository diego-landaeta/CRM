// Meta Ads API client (CRM-101)
// Contrato definido en docs/03-api-endpoints.md > Meta Ads
// Backend pendiente (modulo `meta-ads` por implementar). Mientras tanto, USE_MOCKS=true.

import client, { type ApiResponse } from '@/shared/api/client';
import { metaCampaignsMock } from '../mocks/meta.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export type MetaStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type MetaLevel = 'campaign' | 'adset' | 'ad';

export interface MetaMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface MetaCampaign {
  campaignId: string;
  campaignName: string;
  status: MetaStatus;
  objective: string;
  metrics: MetaMetrics;
  crmLeadCount: number;
  crmConversionCount: number;
  costPerCrmLead: number;
  costPerCrmConversion: number;
}

export interface MetaCampaignsParams {
  fechaDesde?: string;
  fechaHasta?: string;
  level?: MetaLevel;
}

export async function getMetaCampaigns(projectId: string | number, params: MetaCampaignsParams = {}): Promise<ApiResponse<MetaCampaign[]>> {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: metaCampaignsMock(projectId, params) };
  }
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return client.get<MetaCampaign[]>(`/meta/campaigns/${projectId}${qs ? '?' + qs : ''}`);
}
