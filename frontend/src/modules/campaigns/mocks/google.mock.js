// Mock data realista para CRM-104 (Google Ads campaigns)
// Estructura espejo del contrato Google Ads API + extension cross-CRM definido en CRM-104.md

const SAMPLE_CAMPAIGNS = {
  // project_id 1 (Psiko Aprende)
  1: {
    campaigns: [
      { campaignId: '20012345678', campaignName: 'Search - Psiko Master Otono', status: 'ENABLED', type: 'SEARCH',
        metrics: { impressions: 124_000, clicks: 5_280, spend: 1_580.00, ctr: 4.26, cpc: 0.30, conversions: 84, conversionRate: 1.59 },
        crmLeadCount: 96, crmConversionCount: 14, costPerCrmLead: 16.46, costPerCrmConversion: 112.86 },
      { campaignId: '20012345679', campaignName: 'PMax - Forensia + Clinica', status: 'ENABLED', type: 'PERFORMANCE_MAX',
        metrics: { impressions: 220_000, clicks: 4_100, spend: 980.00, ctr: 1.86, cpc: 0.24, conversions: 38, conversionRate: 0.93 },
        crmLeadCount: 52, crmConversionCount: 7, costPerCrmLead: 18.85, costPerCrmConversion: 140.00 },
      { campaignId: '20012345680', campaignName: 'Display - Remarketing', status: 'PAUSED', type: 'DISPLAY',
        metrics: { impressions: 480_000, clicks: 1_920, spend: 280.00, ctr: 0.40, cpc: 0.15, conversions: 8, conversionRate: 0.42 },
        crmLeadCount: 14, crmConversionCount: 2, costPerCrmLead: 20.00, costPerCrmConversion: 140.00 },
    ],
    keywords: [
      { keyword: 'master psicologia forense', matchType: 'PHRASE', impressions: 18_400, clicks: 1_240, spend: 410.00, ctr: 6.74, cpc: 0.33, qualityScore: 8 },
      { keyword: 'curso psicologia clinica online', matchType: 'PHRASE', impressions: 22_100, clicks: 980, spend: 312.00, ctr: 4.43, cpc: 0.32, qualityScore: 7 },
      { keyword: '"master psicologia"', matchType: 'EXACT', impressions: 9_800, clicks: 720, spend: 245.00, ctr: 7.35, cpc: 0.34, qualityScore: 9 },
      { keyword: 'estudiar psicologia distancia', matchType: 'BROAD', impressions: 35_000, clicks: 1_180, spend: 380.00, ctr: 3.37, cpc: 0.32, qualityScore: 6 },
      { keyword: 'psicologo titulacion', matchType: 'PHRASE', impressions: 12_000, clicks: 480, spend: 168.00, ctr: 4.00, cpc: 0.35, qualityScore: 7 },
    ],
  },
  // project_id 2 (ISEIH)
  2: {
    campaigns: [
      { campaignId: '20098765432', campaignName: 'Search - ISEIH Grado Superior', status: 'ENABLED', type: 'SEARCH',
        metrics: { impressions: 88_000, clicks: 3_840, spend: 1_120.00, ctr: 4.36, cpc: 0.29, conversions: 62, conversionRate: 1.61 },
        crmLeadCount: 71, crmConversionCount: 11, costPerCrmLead: 15.77, costPerCrmConversion: 101.82 },
      { campaignId: '20098765433', campaignName: 'PMax - Inscripcion 2026', status: 'ENABLED', type: 'PERFORMANCE_MAX',
        metrics: { impressions: 142_000, clicks: 2_640, spend: 740.00, ctr: 1.86, cpc: 0.28, conversions: 22, conversionRate: 0.83 },
        crmLeadCount: 31, crmConversionCount: 5, costPerCrmLead: 23.87, costPerCrmConversion: 148.00 },
    ],
    keywords: [
      { keyword: 'grado superior integracion social', matchType: 'PHRASE', impressions: 14_500, clicks: 920, spend: 290.00, ctr: 6.34, cpc: 0.32, qualityScore: 8 },
      { keyword: 'tcae a distancia', matchType: 'BROAD', impressions: 28_000, clicks: 1_120, spend: 358.00, ctr: 4.00, cpc: 0.32, qualityScore: 7 },
      { keyword: 'fp sanidad online', matchType: 'PHRASE', impressions: 19_200, clicks: 880, spend: 282.00, ctr: 4.58, cpc: 0.32, qualityScore: 7 },
    ],
  },
  // project_id 3 (Fono Aprende)
  3: {
    campaigns: [
      { campaignId: '20055544433', campaignName: 'Search - Fono Taller', status: 'ENABLED', type: 'SEARCH',
        metrics: { impressions: 42_000, clicks: 1_980, spend: 562.00, ctr: 4.71, cpc: 0.28, conversions: 28, conversionRate: 1.41 },
        crmLeadCount: 32, crmConversionCount: 4, costPerCrmLead: 17.56, costPerCrmConversion: 140.50 },
      { campaignId: '20055544434', campaignName: 'Display - Webinar', status: 'PAUSED', type: 'DISPLAY',
        metrics: { impressions: 220_000, clicks: 880, spend: 132.00, ctr: 0.40, cpc: 0.15, conversions: 4, conversionRate: 0.45 },
        crmLeadCount: 6, crmConversionCount: 1, costPerCrmLead: 22.00, costPerCrmConversion: 132.00 },
    ],
    keywords: [
      { keyword: 'logopedia infantil online', matchType: 'PHRASE', impressions: 12_400, clicks: 720, spend: 220.00, ctr: 5.81, cpc: 0.31, qualityScore: 8 },
      { keyword: 'master logopedia', matchType: 'EXACT', impressions: 6_800, clicks: 440, spend: 152.00, ctr: 6.47, cpc: 0.35, qualityScore: 9 },
    ],
  },
  default: { campaigns: [], keywords: [] },
};

export function googleCampaignsMock(projectId, params = {}) {
  const data = SAMPLE_CAMPAIGNS[projectId] || SAMPLE_CAMPAIGNS.default;
  const desde = params.fechaDesde ? new Date(params.fechaDesde) : new Date(Date.now() - 30 * 86400000);
  const hasta = params.fechaHasta ? new Date(params.fechaHasta) : new Date();
  const days = Math.max(1, Math.round((hasta - desde) / 86400000));
  const factor = Math.min(1, days / 30);
  return {
    campaigns: data.campaigns.map(c => ({
      ...c,
      metrics: {
        ...c.metrics,
        impressions: Math.round(c.metrics.impressions * factor),
        clicks: Math.round(c.metrics.clicks * factor),
        spend: Math.round(c.metrics.spend * factor * 100) / 100,
        conversions: Math.round(c.metrics.conversions * factor),
      },
      crmLeadCount: Math.round(c.crmLeadCount * factor),
      crmConversionCount: Math.round(c.crmConversionCount * factor),
    })),
    keywords: data.keywords.map(k => ({
      ...k,
      impressions: Math.round(k.impressions * factor),
      clicks: Math.round(k.clicks * factor),
      spend: Math.round(k.spend * factor * 100) / 100,
    })),
  };
}
