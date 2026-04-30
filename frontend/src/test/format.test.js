import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyShort,
  formatNumber,
  formatDate,
  formatDateShort,
  formatDateNumeric,
  formatDateTime,
} from '@/shared/lib/format';

describe('formatCurrency', () => {
  it('formatea con dos decimales y símbolo €', () => {
    const r = formatCurrency(1234.5);
    expect(r).toContain('1234,50');
    expect(r).toContain('€');
  });

  it('null/undefined/string vacío devuelven 0,00 €', () => {
    expect(formatCurrency(null)).toMatch(/0,00/);
    expect(formatCurrency(undefined)).toMatch(/0,00/);
    expect(formatCurrency('')).toMatch(/0,00/);
  });

  it('coacciona strings a número', () => {
    expect(formatCurrency('100.50')).toMatch(/100,50/);
  });
});

describe('formatCurrencyShort', () => {
  it('redondea a entero (sin decimales)', () => {
    const r = formatCurrencyShort(1234.5);
    expect(r).not.toMatch(/,/);
    expect(r).toMatch(/123[45]/);
  });
});

describe('formatNumber', () => {
  it('formatea números grandes en es-ES', () => {
    const r = formatNumber(1234567);
    // El separador puede ser "." o no aparecer según versión Intl
    expect(r).toMatch(/1.?234.?567/);
  });
  it('null devuelve "0"', () => {
    expect(formatNumber(null)).toBe('0');
  });
});

describe('formatDate', () => {
  it('devuelve "--" para vacío/null', () => {
    expect(formatDate(null)).toBe('--');
    expect(formatDate(undefined)).toBe('--');
    expect(formatDate('')).toBe('--');
  });

  it('devuelve "--" para fecha inválida', () => {
    expect(formatDate('no-es-fecha')).toBe('--');
  });

  it('formatea con día, mes corto y año', () => {
    const r = formatDate('2024-03-15T10:00:00.000Z');
    expect(r).toMatch(/\d{1,2}/);
    expect(r).toMatch(/[a-z]{3}/i);
    expect(r).toMatch(/2024/);
  });

  it('acepta Date object', () => {
    const r = formatDate(new Date('2024-06-01'));
    expect(r).toMatch(/2024/);
  });
});

describe('formatDateShort', () => {
  it('formatea sin año', () => {
    const r = formatDateShort('2024-03-15');
    expect(r).not.toMatch(/2024/);
    expect(r).toMatch(/[a-z]{3}/i);
  });
  it('vacío → "--"', () => {
    expect(formatDateShort(null)).toBe('--');
  });
});

describe('formatDateNumeric', () => {
  it('formatea como dd/MM/yyyy en es-ES', () => {
    const r = formatDateNumeric('2024-03-15');
    expect(r).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('formatDateTime', () => {
  it('incluye hora y minuto', () => {
    const r = formatDateTime('2024-03-15T14:30:00.000Z');
    expect(r).toMatch(/2024/);
    expect(r).toMatch(/\d{1,2}:\d{2}/);
  });
  it('vacío → "--"', () => {
    expect(formatDateTime(null)).toBe('--');
  });
});
