import { describe, it, expect } from 'vitest';
import { normalizeStats, normalizeLead } from '@/shared/hooks/useDashboard';

describe('normalizeStats — KPIs visibles en dashboard', () => {
  it('devuelve ceros + rates 0 con input vacío/null', () => {
    expect(normalizeStats(null)).toMatchObject({
      total: 0,
      nuevo: 0,
      por_contactar: 0,
      contactado: 0,
      en_seguimiento: 0,
      convertido: 0,
      no_interesado: 0,
      conversionRate: 0,
      abandonRate: 0,
    });
    expect(normalizeStats(undefined).conversionRate).toBe(0);
    expect(normalizeStats({}).abandonRate).toBe(0);
  });

  it('mapea plurales del backend a singulares', () => {
    const r = normalizeStats({
      total: 100,
      nuevos: 20,
      por_contactar: 15,
      contactados: 30,
      en_seguimiento: 10,
      convertidos: 20,
      no_interesados: 5,
    });
    expect(r.total).toBe(100);
    expect(r.nuevo).toBe(20);
    expect(r.contactado).toBe(30);
    expect(r.convertido).toBe(20);
    expect(r.no_interesado).toBe(5);
  });

  it('calcula conversionRate como % entero (round)', () => {
    expect(normalizeStats({ total: 100, convertidos: 25 }).conversionRate).toBe(25);
    expect(normalizeStats({ total: 200, convertidos: 33 }).conversionRate).toBe(17); // 16.5 → 17
    expect(normalizeStats({ total: 3, convertidos: 1 }).conversionRate).toBe(33); // 33.33 → 33
  });

  it('calcula abandonRate como % entero (round)', () => {
    expect(normalizeStats({ total: 100, no_interesados: 10 }).abandonRate).toBe(10);
    expect(normalizeStats({ total: 7, no_interesados: 3 }).abandonRate).toBe(43); // 42.85 → 43
  });

  it('total = 0 → conversionRate y abandonRate son 0 (no NaN/Infinity)', () => {
    const r = normalizeStats({ total: 0, convertidos: 5, no_interesados: 3 });
    expect(r.conversionRate).toBe(0);
    expect(r.abandonRate).toBe(0);
    expect(Number.isFinite(r.conversionRate)).toBe(true);
    expect(Number.isFinite(r.abandonRate)).toBe(true);
  });

  it('coacciona strings numéricos del backend a Number', () => {
    const r = normalizeStats({ total: '100', convertidos: '25', nuevos: '40' });
    expect(r.total).toBe(100);
    expect(r.convertido).toBe(25);
    expect(r.nuevo).toBe(40);
    expect(r.conversionRate).toBe(25);
  });

  it('valores no-numéricos caen a 0', () => {
    const r = normalizeStats({ total: 'abc', convertidos: null, nuevos: undefined });
    expect(r.total).toBe(0);
    expect(r.convertido).toBe(0);
    expect(r.nuevo).toBe(0);
    expect(r.conversionRate).toBe(0);
  });
});

describe('normalizeLead', () => {
  it('devuelve null/undefined sin romper', () => {
    expect(normalizeLead(null)).toBe(null);
    expect(normalizeLead(undefined)).toBe(undefined);
  });

  it('mapea status del backend a estado', () => {
    const r = normalizeLead({ id: 1, status: 'contactado', nombre: 'X' });
    expect(r.estado).toBe('contactado');
  });

  it('preserva estado si ya viene como tal', () => {
    const r = normalizeLead({ id: 1, estado: 'nuevo', nombre: 'X' });
    expect(r.estado).toBe('nuevo');
  });

  it('mapea canal_detectado a origen', () => {
    const r = normalizeLead({ id: 1, canal_detectado: 'whatsapp' });
    expect(r.origen).toBe('whatsapp');
  });

  it('fallback a "directo" si no hay canal ni origen', () => {
    expect(normalizeLead({ id: 1 }).origen).toBe('directo');
  });

  it('preserva origen explícito sobre default "directo"', () => {
    expect(normalizeLead({ id: 1, origen: 'meta_ads' }).origen).toBe('meta_ads');
  });

  it('canal_detectado tiene precedencia sobre origen', () => {
    const r = normalizeLead({ id: 1, canal_detectado: 'whatsapp', origen: 'web' });
    expect(r.origen).toBe('whatsapp');
  });

  it('preserva el resto de campos del lead', () => {
    const r = normalizeLead({ id: 1, status: 'nuevo', nombre: 'Ana', email: 'a@x.com' });
    expect(r.id).toBe(1);
    expect(r.nombre).toBe('Ana');
    expect(r.email).toBe('a@x.com');
  });
});
