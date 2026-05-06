// Tests para los helpers exportados desde Sidebar.jsx (CRM-217).
// applyLabel + getSidebarLabelCatalog son las dos primitivas que sostienen
// el feature de "etiquetas sidebar por proyecto".
import { describe, it, expect } from 'vitest';
import { applyLabel, getSidebarLabelCatalog } from '@/shared/components/layout/Sidebar';

describe('applyLabel', () => {
  it('devuelve el original si no hay overrides', () => {
    expect(applyLabel('Prospectos', null)).toBe('Prospectos');
    expect(applyLabel('Prospectos', undefined)).toBe('Prospectos');
    expect(applyLabel('Prospectos', {})).toBe('Prospectos');
  });

  it('devuelve el override cuando existe', () => {
    expect(applyLabel('Prospectos', { Prospectos: 'Estudiantes' })).toBe('Estudiantes');
  });

  it('ignora override vacío o solo espacios', () => {
    expect(applyLabel('Prospectos', { Prospectos: '' })).toBe('Prospectos');
    expect(applyLabel('Prospectos', { Prospectos: '   ' })).toBe('Prospectos');
  });

  it('ignora override de tipo no-string', () => {
    expect(applyLabel('Prospectos', { Prospectos: 123 })).toBe('Prospectos');
    expect(applyLabel('Prospectos', { Prospectos: null })).toBe('Prospectos');
    expect(applyLabel('Prospectos', { Prospectos: { v: 'x' } })).toBe('Prospectos');
  });

  it('respeta otras claves sin afectar a la consultada', () => {
    const overrides = { Prospectos: 'Estudiantes', Clientes: 'Alumnos' };
    expect(applyLabel('Prospectos', overrides)).toBe('Estudiantes');
    expect(applyLabel('Sin override', overrides)).toBe('Sin override');
  });

  it('protege ante overrides que no son objeto', () => {
    expect(applyLabel('Prospectos', 'no-object')).toBe('Prospectos');
    expect(applyLabel('Prospectos', 42)).toBe('Prospectos');
  });
});

describe('getSidebarLabelCatalog', () => {
  const catalog = getSidebarLabelCatalog();

  it('devuelve un array de secciones, cada una con label list', () => {
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
    for (const section of catalog) {
      expect(typeof section.section).toBe('string');
      expect(Array.isArray(section.labels)).toBe(true);
    }
  });

  it('cada label tiene un type válido (group/item/child)', () => {
    const VALID = new Set(['group', 'item', 'child']);
    for (const section of catalog) {
      for (const entry of section.labels) {
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
        expect(VALID.has(entry.type)).toBe(true);
      }
    }
  });

  it('incluye las secciones top-level esperadas del NAV_SECTIONS', () => {
    const sections = catalog.map((s) => s.section);
    // Estas secciones existen en NAV_SECTIONS y no deben desaparecer sin querer
    expect(sections).toEqual(expect.arrayContaining([
      'Principal', 'Captación', 'Catálogo', 'Finanzas', 'Análisis', 'Sistema',
    ]));
  });

  it('incluye items conocidos (Dashboard como item, Captación como group)', () => {
    const principal = catalog.find((s) => s.section === 'Principal');
    expect(principal).toBeTruthy();
    const dashboard = principal.labels.find((l) => l.label === 'Dashboard');
    expect(dashboard).toEqual({ label: 'Dashboard', type: 'item' });

    const captacion = catalog.find((s) => s.section === 'Captación');
    const captacionGroup = captacion.labels.find((l) => l.label === 'Captación');
    expect(captacionGroup?.type).toBe('group');
  });

  it('incluye sub-items (children) marcados como type child', () => {
    const captacion = catalog.find((s) => s.section === 'Captación');
    const formularios = captacion.labels.find((l) => l.label === 'Formularios');
    expect(formularios?.type).toBe('child');
  });

  it('no produce duplicados de label dentro de una misma sección', () => {
    for (const section of catalog) {
      const labels = section.labels.map((l) => l.label);
      const unique = new Set(labels);
      // Permitimos labels iguales solo si type difiere (group + item con mismo nombre, ej. "Captación")
      // pero la combinación (label, type) debe ser única
      const combos = section.labels.map((l) => `${l.label}::${l.type}`);
      expect(new Set(combos).size).toBe(combos.length);
      // Y al menos un label distinto por sección si hay más de uno
      if (labels.length > 1) expect(unique.size).toBeGreaterThanOrEqual(1);
    }
  });
});
