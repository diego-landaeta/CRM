import { describe, it, expect, vi, afterEach } from 'vitest';
import { desdeHace } from '../modules/leads/components/PanelDeCola';

/**
 * «Último asignado: Laura García · hace 5 min» (#11).
 *
 * Ese «hace 5 min» es lo que hace util el dato: saber que el ultimo reparto fue
 * hace un rato o hace tres dias cambia por completo lo que significa la cola.
 *
 * Se prueba aparte porque es lo unico del panel que no es pintar: el resto sale
 * tal cual del endpoint.
 */

const enQue = (iso: string) => { vi.setSystemTime(new Date(iso)); };
afterEach(() => { vi.useRealTimers(); });

describe('cuanto hace del ultimo reparto', () => {
  it('sin fecha, no se dice nada', () => {
    expect(desdeHace(null)).toBeNull();
  });

  it('una fecha rota tampoco inventa un «hace 56 años»', () => {
    // Un `Invalid Date` daba NaN y salia «hace NaN min».
    expect(desdeHace('esto no es una fecha')).toBeNull();
  });

  it('hace un momento', () => {
    vi.useFakeTimers(); enQue('2026-09-03T12:00:30Z');
    expect(desdeHace('2026-09-03T12:00:00Z')).toBe('hace un momento');
  });

  it('en minutos', () => {
    vi.useFakeTimers(); enQue('2026-09-03T12:05:00Z');
    expect(desdeHace('2026-09-03T12:00:00Z')).toBe('hace 5 min');
  });

  it('en horas', () => {
    vi.useFakeTimers(); enQue('2026-09-03T15:00:00Z');
    expect(desdeHace('2026-09-03T12:00:00Z')).toBe('hace 3 h');
  });

  it('ayer', () => {
    vi.useFakeTimers(); enQue('2026-09-04T12:00:00Z');
    expect(desdeHace('2026-09-03T12:00:00Z')).toBe('ayer');
  });

  it('varios dias', () => {
    vi.useFakeTimers(); enQue('2026-09-06T12:00:00Z');
    expect(desdeHace('2026-09-03T12:00:00Z')).toBe('hace 3 días');
  });

  it('una fecha del futuro no dice «hace -2 min»', () => {
    // Pasa con el reloj del servidor por delante del navegador, que es normal.
    vi.useFakeTimers(); enQue('2026-09-03T12:00:00Z');
    expect(desdeHace('2026-09-03T12:02:00Z')).toBe('ahora mismo');
  });
});
