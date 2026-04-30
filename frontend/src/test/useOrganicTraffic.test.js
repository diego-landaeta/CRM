import { describe, it, expect } from 'vitest';
import { rangeFromPreset, PRESET_PERIODS } from '@/modules/seo/hooks/useOrganicTraffic';

describe('rangeFromPreset (GSC) — retraso 3 días + ventana', () => {
  it('PRESET_PERIODS: 7d, 14d, 28d, 90d (28d es default)', () => {
    expect(Object.keys(PRESET_PERIODS).sort()).toEqual(['14d', '28d', '7d', '90d']);
  });

  it('preset desconocido cae a 28 días', () => {
    const now = new Date('2026-04-15T12:00:00Z').getTime();
    const r = rangeFromPreset('xxx', now);
    const desde = new Date(r.fechaDesde);
    const hasta = new Date(r.fechaHasta);
    const diff = (hasta - desde) / 86400000;
    expect(diff).toBeGreaterThanOrEqual(27.5);
    expect(diff).toBeLessThanOrEqual(28.5);
  });

  it('fechaHasta = hoy - 3 días (retraso GSC)', () => {
    // 2026-04-15 → fechaHasta = 2026-04-12
    const now = new Date('2026-04-15T12:00:00Z').getTime();
    const r = rangeFromPreset('7d', now);
    expect(r.fechaHasta).toBe('2026-04-12');
  });

  it('preset "7d": fechaDesde = fechaHasta - 7 días', () => {
    const now = new Date('2026-04-15T12:00:00Z').getTime();
    const r = rangeFromPreset('7d', now);
    expect(r.fechaHasta).toBe('2026-04-12');
    expect(r.fechaDesde).toBe('2026-04-05'); // 12 - 7 = 5
  });

  it('preset "28d" — ventana correcta', () => {
    const now = new Date('2026-04-15T12:00:00Z').getTime();
    const r = rangeFromPreset('28d', now);
    expect(r.fechaHasta).toBe('2026-04-12');
    expect(r.fechaDesde).toBe('2026-03-15'); // 12 - 28 = mar 15
  });

  it('cruce de mes (febrero año NO bisiesto, 28 días)', () => {
    // 2026-03-15 → hasta = 2026-03-12 → desde 7d = 2026-03-05
    const now = new Date('2026-03-15T12:00:00Z').getTime();
    const r = rangeFromPreset('7d', now);
    expect(r.fechaDesde).toBe('2026-03-05');
    expect(r.fechaHasta).toBe('2026-03-12');
  });

  it('cruce año bisiesto: 2024-03-04 → fechaHasta = 2024-03-01 (3 días atrás)', () => {
    const now = new Date('2024-03-04T12:00:00Z').getTime();
    const r = rangeFromPreset('7d', now);
    // fechaHasta = 2024-03-01, fechaDesde = 2024-02-23 (sumando 7 días atrás)
    expect(r.fechaHasta).toBe('2024-03-01');
    expect(r.fechaDesde).toBe('2024-02-23');
  });

  it('cruce año bisiesto desde 2024-03-02 (off-by-one feb 29)', () => {
    // 2024-03-02 → hasta = 2024-02-28 (3 días atrás), 7d → desde 2024-02-21
    const now = new Date('2024-03-02T12:00:00Z').getTime();
    const r = rangeFromPreset('7d', now);
    expect(r.fechaHasta).toBe('2024-02-28');
    expect(r.fechaDesde).toBe('2024-02-21');
  });

  it('formato YYYY-MM-DD en ambas fechas', () => {
    const r = rangeFromPreset('30d', Date.now());
    expect(r.fechaDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.fechaHasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
