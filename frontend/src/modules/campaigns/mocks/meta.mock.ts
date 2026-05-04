// Mock data realista para CRM-101 (Meta Ads campaigns)
// Estructura espejo del contrato Meta Marketing API definido en docs/03-api-endpoints.md
import type { MetaCampaign, MetaCampaignsParams } from '../api/meta.api';

const SAMPLE_CAMPAIGNS: Record<string | number, MetaCampaign[]> = {
  // project_id 1 (Psiko Aprende)
  1: [
    { campaignId: '120201234567890123', campaignName: 'Psiko Master Otono 2026 - Conversion', status: 'ACTIVE', objective: 'LEAD_GENERATION',
      metrics: { impressions: 248_530, clicks: 6_842, spend: 1_840.65, ctr: 2.75, cpc: 0.27, cpm: 7.41 },
      crmLeadCount: 142, crmConversionCount: 18, costPerCrmLead: 12.96, costPerCrmConversion: 102.26 },
    { campaignId: '120201234567890124', campaignName: 'Psiko Forensia Webinar - Lead Form', status: 'ACTIVE', objective: 'LEAD_GENERATION',
      metrics: { impressions: 89_120, clicks: 2_104, spend: 624.30, ctr: 2.36, cpc: 0.30, cpm: 7.00 },
      crmLeadCount: 67, crmConversionCount: 9, costPerCrmLead: 9.32, costPerCrmConversion: 69.37 },
    { campaignId: '120201234567890125', campaignName: 'Psiko Retargeting - Carritos', status: 'PAUSED', objective: 'CONVERSIONS',
      metrics: { impressions: 42_000, clicks: 1_280, spend: 412.00, ctr: 3.05, cpc: 0.32, cpm: 9.81 },
      crmLeadCount: 28, crmConversionCount: 11, costPerCrmLead: 14.71, costPerCrmConversion: 37.45 },
    { campaignId: '120201234567890126', campaignName: 'Psiko Branding Q1', status: 'COMPLETED', objective: 'BRAND_AWARENESS',
      metrics: { impressions: 520_000, clicks: 4_100, spend: 980.00, ctr: 0.79, cpc: 0.24, cpm: 1.88 },
      crmLeadCount: 12, crmConversionCount: 1, costPerCrmLead: 81.67, costPerCrmConversion: 980.00 },
  ],
  // project_id 2 (ISEIH)
  2: [
    { campaignId: '120201234567890200', campaignName: 'ISEIH Grado Superior 2026 - Lead Form', status: 'ACTIVE', objective: 'LEAD_GENERATION',
      metrics: { impressions: 178_400, clicks: 4_530, spend: 1_320.18, ctr: 2.54, cpc: 0.29, cpm: 7.40 },
      crmLeadCount: 98, crmConversionCount: 14, costPerCrmLead: 13.47, costPerCrmConversion: 94.30 },
    { campaignId: '120201234567890201', campaignName: 'ISEIH Conversion - Inscripcion', status: 'ACTIVE', objective: 'CONVERSIONS',
      metrics: { impressions: 52_300, clicks: 1_640, spend: 580.40, ctr: 3.14, cpc: 0.35, cpm: 11.10 },
      crmLeadCount: 41, crmConversionCount: 7, costPerCrmLead: 14.16, costPerCrmConversion: 82.91 },
  ],
  // project_id 3 (Fono Aprende)
  3: [
    { campaignId: '120201234567890300', campaignName: 'Fono Taller 2026 - Lead Form', status: 'ACTIVE', objective: 'LEAD_GENERATION',
      metrics: { impressions: 64_120, clicks: 1_840, spend: 482.50, ctr: 2.87, cpc: 0.26, cpm: 7.52 },
      crmLeadCount: 38, crmConversionCount: 5, costPerCrmLead: 12.70, costPerCrmConversion: 96.50 },
    { campaignId: '120201234567890301', campaignName: 'Fono Retargeting - Webinar', status: 'PAUSED', objective: 'CONVERSIONS',
      metrics: { impressions: 18_000, clicks: 520, spend: 156.00, ctr: 2.89, cpc: 0.30, cpm: 8.67 },
      crmLeadCount: 14, crmConversionCount: 4, costPerCrmLead: 11.14, costPerCrmConversion: 39.00 },
  ],
  // Fallback
  default: [],
};

export function metaCampaignsMock(projectId: string | number, params: MetaCampaignsParams = {}): MetaCampaign[] {
  const list = SAMPLE_CAMPAIGNS[projectId] || SAMPLE_CAMPAIGNS.default;
  // Reflejamos el filtro de fechas dividiendo proporcionalmente las metricas
  const desde = params.fechaDesde ? new Date(params.fechaDesde) : new Date(Date.now() - 30 * 86400000);
  const hasta = params.fechaHasta ? new Date(params.fechaHasta) : new Date();
  const days = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86400000));
  const factor = Math.min(1, days / 30);
  return list.map(c => ({
    ...c,
    metrics: {
      ...c.metrics,
      impressions: Math.round(c.metrics.impressions * factor),
      clicks: Math.round(c.metrics.clicks * factor),
      spend: Math.round(c.metrics.spend * factor * 100) / 100,
    },
    crmLeadCount: Math.round(c.crmLeadCount * factor),
    crmConversionCount: Math.round(c.crmConversionCount * factor),
  }));
}
