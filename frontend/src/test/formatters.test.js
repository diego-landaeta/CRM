import { describe, it, expect } from 'vitest';

// Helpers re-exportados para test (copiamos la logica del modulo, evita dependencias react)
function formatRelative(dateStr, { future = false } = {}) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = future ? d - now : now - d;
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 0) return future ? `hace ${-diffDays}d` : null;
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return future ? 'manana' : 'ayer';
  if (diffDays < 7) return future ? `en ${diffDays}d` : `hace ${diffDays}d`;
  if (diffDays < 30) return future ? `en ${Math.round(diffDays / 7)}sem` : `hace ${Math.round(diffDays / 7)}sem`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function cleanPhone(phone) {
  return (phone || '').replace(/[^\d]/g, '');
}

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

  it('devuelve "manana" para en 1 dia (future)', () => {
    expect(formatRelative(new Date(Date.now() + 86400000).toISOString(), { future: true })).toBe('manana');
  });

  it('devuelve "hace Nd" para fechas pasadas dentro de la semana', () => {
    expect(formatRelative(new Date(Date.now() - 3 * 86400000).toISOString())).toBe('hace 3d');
  });

  it('devuelve "en Nd" para fechas futuras dentro de la semana', () => {
    expect(formatRelative(new Date(Date.now() + 4 * 86400000).toISOString(), { future: true })).toBe('en 4d');
  });

  it('devuelve "hace Nsem" para fechas pasadas entre 7 y 30 dias', () => {
    const r = formatRelative(new Date(Date.now() - 14 * 86400000).toISOString());
    expect(r).toMatch(/hace 2sem/);
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
