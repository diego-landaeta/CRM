import { describe, it, expect } from 'vitest';
import {
  monthLabel,
  isInMonth,
  buildCommissionsCsv,
} from '@/modules/commissions/lib/period';

describe('CommissionsPage period helpers (CRM-138)', () => {
  describe('monthLabel', () => {
    it('formatea mes y año en español', () => {
      const label = monthLabel(2026, 4);
      expect(label.toLowerCase()).toContain('abril');
      expect(label).toContain('2026');
    });

    it('formatea enero correctamente (mes 1)', () => {
      const label = monthLabel(2025, 1);
      expect(label.toLowerCase()).toContain('enero');
    });
  });

  describe('isInMonth', () => {
    it('coincide cuando year/month match', () => {
      expect(isInMonth('2026-04-15T10:30:00Z', 2026, 4)).toBe(true);
    });

    it('no coincide en otro mes', () => {
      expect(isInMonth('2026-04-15', 2026, 5)).toBe(false);
    });

    it('no coincide en otro año', () => {
      expect(isInMonth('2025-04-15', 2026, 4)).toBe(false);
    });

    it('rechaza null/undefined', () => {
      expect(isInMonth(null, 2026, 4)).toBe(false);
      expect(isInMonth(undefined, 2026, 4)).toBe(false);
      expect(isInMonth('', 2026, 4)).toBe(false);
    });

    it('rechaza fechas inválidas', () => {
      expect(isInMonth('no-es-fecha', 2026, 4)).toBe(false);
    });

    it('detecta primer día del mes', () => {
      // T12:00 evita el flake por timezone (UTC midnight retrocedería un día en TZ negativos)
      expect(isInMonth('2026-04-01T12:00:00', 2026, 4)).toBe(true);
    });
  });

  describe('buildCommissionsCsv', () => {
    const sample = [
      {
        id: 1,
        created_at: '2026-04-10T00:00:00Z',
        user_nombre: 'Juan',
        lead_nombre: 'Pepe',
        product_nombre: 'Curso A',
        importe_base: 100,
        pct: 10,
        importe_comision: 10,
        estado: 'pendiente',
      },
    ];

    it('incluye header con periodo', () => {
      const { csv } = buildCommissionsCsv(sample, 'abril 2026');
      expect(csv).toContain('Comisiones — abril 2026');
    });

    it('incluye row de columnas', () => {
      const { csv } = buildCommissionsCsv(sample, 'abril 2026');
      expect(csv).toContain('Gestor');
      expect(csv).toContain('Comisión (€)');
    });

    it('renderiza datos del registro', () => {
      const { csv } = buildCommissionsCsv(sample, 'abril 2026');
      expect(csv).toContain('Juan');
      expect(csv).toContain('Pepe');
      expect(csv).toContain('Curso A');
      expect(csv).toContain('100.00');
      expect(csv).toContain('10.00');
      expect(csv).toContain('pendiente');
    });

    it('escapea comillas dobles', () => {
      const { csv } = buildCommissionsCsv(
        [{ ...sample[0], lead_nombre: 'Pepe "el grande"' }],
        'abril 2026',
      );
      expect(csv).toContain('Pepe ""el grande""');
    });

    it('genera filename slugificado', () => {
      const { filename } = buildCommissionsCsv(sample, 'abril 2026');
      expect(filename).toBe('comisiones-abril_2026.csv');
    });

    it('maneja lista vacía sin romper', () => {
      const { csv, filename } = buildCommissionsCsv([], 'abril 2026');
      expect(csv).toContain('Comisiones — abril 2026');
      expect(csv).toContain('Gestor');
      expect(filename).toBe('comisiones-abril_2026.csv');
    });

    it('usa producto_contratado si product_nombre es null', () => {
      const items = [{ ...sample[0], product_nombre: null, producto_contratado: 'Fallback' }];
      const { csv } = buildCommissionsCsv(items, 'abril 2026');
      expect(csv).toContain('Fallback');
    });
  });
});
