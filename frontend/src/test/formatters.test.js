import { describe, it, expect } from 'vitest';
import { formatRelative, cleanPhone } from '@/modules/leads/lib/leadFormat';

// NOTA: estos tests importan los helpers REALES del módulo leads/lib.
// Anteriormente eran una copia inline (test fantasma) — si leadFormat
// cambiaba, los tests seguían verdes. Ahora protegen el módulo de verdad.

describe('formatRelative', () => {
  it('devuelve null si no hay fecha', () => {
    expect(formatRelative()).toBe(null);
    expect(formatRelative(null)).toBe(null);
    expect(formatRelative('')).toBe(null);
  });

  it('devuelve "hoy" para fecha de hoy', () => {
    expect(formatRelative(new Date().toISOString())).toBe('hoy');
  });

  it('devuelve "ayer" para hace 1 dia (past)', () => {
    expect(formatRelative(new Date(Date.now() - 86400000).toISOString())).toBe('ayer');
  });

  it('devuelve "mañana" para en 1 dia (future)', () => {
    expect(formatRelative(new Date(Date.now() + 86400000).toISOString(), { future: true })).toBe('mañana');
  });

  it('devuelve "hace Nd" para fechas pasadas dentro de la semana', () => {
    expect(formatRelative(new Date(Date.now() - 3 * 86400000).toISOString())).toBe('hace 3d');
  });

  it('devuelve "en Nd" para fechas futuras dentro de la semana', () => {
    expect(formatRelative(new Date(Date.now() + 4 * 86400000).toISOString(), { future: true })).toBe('en 4d');
  });

  it('devuelve "hace N sem" para fechas pasadas entre 7 y 30 dias', () => {
    const r = formatRelative(new Date(Date.now() - 14 * 86400000).toISOString());
    expect(r).toMatch(/hace 2 sem/);
  });
});

describe('cleanPhone', () => {
  it('quita espacios, signos y parentesis', () => {
    expect(cleanPhone('+34 666 11 22 33')).toBe('34666112233');
    expect(cleanPhone('(34) 666-11-22')).toBe('346661122');
  });

  it('maneja undefined/null sin romper', () => {
    expect(cleanPhone()).toBe('');
    expect(cleanPhone(null)).toBe('');
  });

  it('mantiene solo digitos', () => {
    expect(cleanPhone('a1b2c3')).toBe('123');
  });
});
