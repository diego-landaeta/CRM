// Tests para el helper de conversión hex → HSL triplet (CRM-191).
import { describe, it, expect } from 'vitest';
import { hexToHslTriplet, isValidHexColor } from '@/shared/lib/color';

describe('hexToHslTriplet', () => {
  it('blanco puro', () => {
    expect(hexToHslTriplet('#ffffff')).toBe('0 0% 100%');
  });

  it('negro puro', () => {
    expect(hexToHslTriplet('#000000')).toBe('0 0% 0%');
  });

  it('rojo puro', () => {
    expect(hexToHslTriplet('#ff0000')).toBe('0 100% 50%');
  });

  it('verde puro', () => {
    expect(hexToHslTriplet('#00ff00')).toBe('120 100% 50%');
  });

  it('azul puro', () => {
    expect(hexToHslTriplet('#0000ff')).toBe('240 100% 50%');
  });

  it('color de marca por defecto del CRM (≈ 230 75% 55%)', () => {
    // El hex equivalente al --primary actual es ~#3b56e0
    const r = hexToHslTriplet('#3b56e0');
    expect(r).toMatch(/^230 (\d+)% (\d+)%$/);
  });

  it('acepta mayúsculas en el hex', () => {
    expect(hexToHslTriplet('#FF0000')).toBe('0 100% 50%');
  });

  it('rechaza hex sin #', () => {
    expect(hexToHslTriplet('ff0000')).toBeNull();
  });

  it('rechaza hex de 3 dígitos (no soportado)', () => {
    expect(hexToHslTriplet('#f00')).toBeNull();
  });

  it('rechaza hex con caracteres no válidos', () => {
    expect(hexToHslTriplet('#zz0000')).toBeNull();
  });

  it('rechaza null/undefined/empty', () => {
    expect(hexToHslTriplet(null)).toBeNull();
    expect(hexToHslTriplet(undefined)).toBeNull();
    expect(hexToHslTriplet('')).toBeNull();
  });

  it('limpia espacios alrededor', () => {
    expect(hexToHslTriplet('  #ff0000  ')).toBe('0 100% 50%');
  });
});

describe('isValidHexColor', () => {
  it('acepta hex válidos', () => {
    expect(isValidHexColor('#3b82f6')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
  });

  it('rechaza variantes inválidas', () => {
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('3b82f6')).toBe(false);
    expect(isValidHexColor('#zzzzzz')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
  });
});
