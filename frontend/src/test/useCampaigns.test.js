import { describe, it, expect } from 'vitest';
import { computeTotals, rangeFromPreset, PRESET_PERIODS } from '@/modules/campaigns/hooks/useCampaigns';

describe('computeTotals — agregación métrica de campañas Meta+Google', () => {
  it('lista vacía devuelve ceros + ratios 0 (no NaN)', () => {
    const r = computeTotals([]);
    expect(r).toEqual({
      spend: 0,
      clicks: 0,
      impressions: 0,
      crmLeads: 0,
      crmConversions: 0,
      cplPlatform: 0,
      costPerCrmLead: 0,
      cpaReal: 0,
    });
    expect(Number.isFinite(r.cplPlatform)).toBe(true);
  });

  it('suma spend/clicks/impressions/crmLeads/crmConversions', () => {
    const r = computeTotals([
      { metrics: { spend: 100, clicks: 50, impressions: 1000 }, crmLeadCount: 5, crmConversionCount: 1 },
      { metrics: { spend: 200, clicks: 100, impressions: 2000 }, crmLeadCount: 10, crmConversionCount: 2 },
    ]);
    expect(r.spend).toBe(300);
    expect(r.clicks).toBe(150);
    expect(r.impressions).toBe(3000);
    expect(r.crmLeads).toBe(15);
    expect(r.crmConversions).toBe(3);
  });

  it('cplPlatform = spend/clicks (CPC promedio)', () => {
    const r = computeTotals([{ metrics: { spend: 100, clicks: 50 } }]);
    expect(r.cplPlatform).toBe(2);
  });

  it('costPerCrmLead = spend/crmLeads', () => {
    const r = computeTotals([{ metrics: { spend: 200 }, crmLeadCount: 10 }]);
    expect(r.costPerCrmLead).toBe(20);
  });

  it('cpaReal = spend/crmConversions', () => {
    const r = computeTotals([{ metrics: { spend: 500 }, crmConversionCount: 5 }]);
    expect(r.cpaReal).toBe(100);
  });

  it('clicks=0 → cplPlatform=0 (no Infinity por división)', () => {
    const r = computeTotals([{ metrics: { spend: 100, clicks: 0 } }]);
    expect(r.cplPlatform).toBe(0);
    expect(Number.isFinite(r.cplPlatform)).toBe(true);
  });

  it('crmLeads=0 → costPerCrmLead=0 (sin leads no hay coste por lead)', () => {
    const r = computeTotals([{ metrics: { spend: 100 }, crmLeadCount: 0 }]);
    expect(r.costPerCrmLead).toBe(0);
  });

  it('crmConversions=0 → cpaReal=0', () => {
    const r = computeTotals([{ metrics: { spend: 100 }, crmConversionCount: 0 }]);
    expect(r.cpaReal).toBe(0);
  });

  it('campos undefined no rompen la suma (fallback a 0)', () => {
    const r = computeTotals([
      { metrics: {} },
      { crmLeadCount: undefined },
      {},
    ]);
    expect(r.spend).toBe(0);
    expect(r.clicks).toBe(0);
    expect(r.crmLeads).toBe(0);
  });

  it('mezcla Meta + Google (sin platform field) — agrega tal cual', () => {
    // computeTotals es agnóstico de plataforma; agrega lo que reciba
    const meta = [{ metrics: { spend: 100, clicks: 50 }, crmLeadCount: 5 }];
    const google = [{ metrics: { spend: 200, clicks: 100 }, crmLeadCount: 10 }];
    const merged = computeTotals([...meta, ...google]);
    expect(merged.spend).toBe(300);
    expect(merged.crmLeads).toBe(15);
  });
});

describe('rangeFromPreset — periodos predefinidos campañas', () => {
  it('preset desconocido cae a 30 días', () => {
    const { fechaDesde, fechaHasta } = rangeFromPreset('xxx');
    const desdeMs = new Date(fechaDesde).getTime();
    const hastaMs = new Date(fechaHasta).getTime();
    expect(Math.round((hastaMs - desdeMs) / 86400000)).toBeGreaterThanOrEqual(29);
    expect(Math.round((hastaMs - desdeMs) / 86400000)).toBeLessThanOrEqual(31);
  });

  it('preset "7d" → ventana de ~7 días', () => {
    const { fechaDesde, fechaHasta } = rangeFromPreset('7d');
    const diff = (new Date(fechaHasta) - new Date(fechaDesde)) / 86400000;
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThanOrEqual(8);
  });

  it('formato ISO YYYY-MM-DD en ambas fechas', () => {
    const r = rangeFromPreset('30d');
    expect(r.fechaDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.fechaHasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('PRESET_PERIODS tiene los 4 esperados', () => {
    expect(Object.keys(PRESET_PERIODS).sort()).toEqual(['14d', '30d', '7d', '90d']);
  });
});
