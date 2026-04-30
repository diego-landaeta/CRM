import { useEffect, useMemo, useState } from 'react';
import { getMetaCampaigns } from '../api/meta.api';
import { getGoogleCampaigns } from '../api/google.api';

/**
 * Periodos predefinidos: 7, 14, 30, 90 dias o custom.
 */
export const PRESET_PERIODS = {
  '7d': { label: 'Ultimos 7 dias', days: 7 },
  '14d': { label: 'Ultimos 14 dias', days: 14 },
  '30d': { label: 'Ultimos 30 dias', days: 30 },
  '90d': { label: 'Ultimos 90 dias', days: 90 },
};

function isoDate(d) { return d.toISOString().slice(0, 10); }

export function rangeFromPreset(preset) {
  const days = PRESET_PERIODS[preset]?.days ?? 30;
  const hasta = new Date();
  const desde = new Date(Date.now() - days * 86400000);
  return { fechaDesde: isoDate(desde), fechaHasta: isoDate(hasta) };
}

export function computeTotals(list) {
  const t = list.reduce((acc, c) => ({
    spend: acc.spend + (c.metrics?.spend || 0),
    clicks: acc.clicks + (c.metrics?.clicks || 0),
    impressions: acc.impressions + (c.metrics?.impressions || 0),
    crmLeads: acc.crmLeads + (c.crmLeadCount || 0),
    crmConversions: acc.crmConversions + (c.crmConversionCount || 0),
  }), { spend: 0, clicks: 0, impressions: 0, crmLeads: 0, crmConversions: 0 });
  return {
    ...t,
    cplPlatform: t.clicks > 0 ? t.spend / t.clicks : 0,        // CPC promedio (Meta cpc / Google cpc)
    costPerCrmLead: t.crmLeads > 0 ? t.spend / t.crmLeads : 0,
    cpaReal: t.crmConversions > 0 ? t.spend / t.crmConversions : 0,
  };
}

/**
 * Usa solo el periodo y comparte estado entre Meta + Google + Consolidado.
 * Carga ambas plataformas cuando hay projectId.
 */
export function useCampaigns(projectId) {
  const [preset, setPreset] = useState('30d');
  const [customRange, setCustomRange] = useState(null);
  const [meta, setMeta] = useState({ campaigns: [], loading: false, error: null });
  const [google, setGoogle] = useState({ campaigns: [], keywords: [], loading: false, error: null });

  const range = customRange || rangeFromPreset(preset);

  useEffect(() => {
    if (!projectId) {
      setMeta({ campaigns: [], loading: false, error: null });
      setGoogle({ campaigns: [], keywords: [], loading: false, error: null });
      return;
    }
    setMeta(s => ({ ...s, loading: true, error: null }));
    setGoogle(s => ({ ...s, loading: true, error: null }));
    Promise.all([
      getMetaCampaigns(projectId, range).then(r => r.success ? r.data : Promise.reject(r.error)),
      getGoogleCampaigns(projectId, range).then(r => r.success ? r.data : Promise.reject(r.error)),
    ]).then(([metaData, googleData]) => {
      setMeta({ campaigns: metaData || [], loading: false, error: null });
      setGoogle({ campaigns: googleData?.campaigns || [], keywords: googleData?.keywords || [], loading: false, error: null });
    }).catch(err => {
      setMeta(s => ({ ...s, loading: false, error: err?.message || String(err) }));
      setGoogle(s => ({ ...s, loading: false, error: err?.message || String(err) }));
    });
  }, [projectId, range.fechaDesde, range.fechaHasta]); // eslint-disable-line

  const metaTotals = useMemo(() => computeTotals(meta.campaigns), [meta.campaigns]);
  const googleTotals = useMemo(() => computeTotals(google.campaigns), [google.campaigns]);

  const consolidatedTotals = useMemo(() => ({
    spend: metaTotals.spend + googleTotals.spend,
    clicks: metaTotals.clicks + googleTotals.clicks,
    impressions: metaTotals.impressions + googleTotals.impressions,
    crmLeads: metaTotals.crmLeads + googleTotals.crmLeads,
    crmConversions: metaTotals.crmConversions + googleTotals.crmConversions,
    costPerCrmLead: (metaTotals.crmLeads + googleTotals.crmLeads) > 0
      ? (metaTotals.spend + googleTotals.spend) / (metaTotals.crmLeads + googleTotals.crmLeads)
      : 0,
    cpaReal: (metaTotals.crmConversions + googleTotals.crmConversions) > 0
      ? (metaTotals.spend + googleTotals.spend) / (metaTotals.crmConversions + googleTotals.crmConversions)
      : 0,
  }), [metaTotals, googleTotals]);

  return {
    meta: { ...meta, totals: metaTotals },
    google: { ...google, totals: googleTotals },
    consolidated: { totals: consolidatedTotals, breakdown: { meta: metaTotals, google: googleTotals } },
    preset, setPreset,
    customRange, setCustomRange,
    range,
    loading: meta.loading || google.loading,
  };
}

// Backward-compat: la version anterior solo exponía Meta
export function useMetaCampaigns(projectId) {
  const all = useCampaigns(projectId);
  return {
    campaigns: all.meta.campaigns,
    totals: all.meta.totals,
    loading: all.meta.loading,
    error: all.meta.error,
    preset: all.preset,
    setPreset: all.setPreset,
    customRange: all.customRange,
    setCustomRange: all.setCustomRange,
    range: all.range,
  };
}
