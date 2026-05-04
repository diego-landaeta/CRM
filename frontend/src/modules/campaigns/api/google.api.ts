// Google Ads API client (CRM-104)
// Contrato definido en docs/03-api-endpoints.md > Google Ads + extension cross-CRM (ver Claude/features/CRM-104.md)
// Backend pendiente (modulo `google-ads` por implementar). Mientras tanto, USE_MOCKS=true.

import client, { type ApiResponse } from '@/shared/api/client';
import { googleCampaignsMock } from '../mocks/google.mock';

const USE_MOCKS = true; // Cambiar a false cuando Diego termine el modulo backend

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export type GoogleStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type GoogleType = 'SEARCH' | 'DISPLAY' | 'VIDEO' | 'SHOPPING' | 'PERFORMANCE_MAX';
export type MatchType = 'EXACT' | 'PHRASE' | 'BROAD';

export interface GoogleMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionRate: number;
}

export interface GoogleCampaign {
  campaignId: string;
  campaignName: string;
  status: GoogleStatus;
  type: GoogleType;
  metrics: GoogleMetrics;
  crmLeadCount: number;
  crmConversionCount: number;
  costPerCrmLead: number;
  costPerCrmConversion: number;
}

export interface GoogleKeyword {
  keyword: string;
  matchType: MatchType;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  qualityScore: number;
}

export interface GoogleCampaignsData {
  campaigns: GoogleCampaign[];
  keywords: GoogleKeyword[];
}

export interface GoogleCampaignsParams {
  fechaDesde?: string;
  fechaHasta?: string;
}

export async function getGoogleCampaigns(projectId: string | number, params: GoogleCampaignsParams = {}): Promise<ApiResponse<GoogleCampaignsData>> {
  if (USE_MOCKS) {
    await delay(300);
    return { success: true, data: googleCampaignsMock(projectId, params) };
  }
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return client.get<GoogleCampaignsData>(`/google/campaigns/${projectId}${qs ? '?' + qs : ''}`);
}
