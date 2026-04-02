import { describe, it, expect } from 'vitest';
import { PROJECTS, PRODUCTS, LEADS, STATS, CAMPAIGNS, REVENUE_MONTHLY, CONVERSIONS } from '@/shared/data/mock';

const PROJECT_IDS = [1, 2, 3, 4, 5, 6];
const VALID_ESTADOS = ['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado'];

describe('PROJECTS', () => {
  it('has 6 items', () => {
    expect(PROJECTS).toHaveLength(6);
  });

  it('each project has id, nombre, slug, type', () => {
    for (const project of PROJECTS) {
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('nombre');
      expect(project).toHaveProperty('slug');
      expect(project).toHaveProperty('type');
    }
  });
});

describe('PRODUCTS', () => {
  it('exists for all 6 project IDs', () => {
    for (const id of PROJECT_IDS) {
      expect(PRODUCTS[id]).toBeDefined();
      expect(Array.isArray(PRODUCTS[id])).toBe(true);
      expect(PRODUCTS[id].length).toBeGreaterThan(0);
    }
  });
});

describe('LEADS', () => {
  it('exists for all 6 project IDs', () => {
    for (const id of PROJECT_IDS) {
      expect(LEADS[id]).toBeDefined();
      expect(Array.isArray(LEADS[id])).toBe(true);
      expect(LEADS[id].length).toBeGreaterThan(0);
    }
  });

  it('each lead has required fields: id, nombre, email, estado, origen, gestor, fecha', () => {
    for (const id of PROJECT_IDS) {
      for (const lead of LEADS[id]) {
        expect(lead).toHaveProperty('id');
        expect(lead).toHaveProperty('nombre');
        expect(lead).toHaveProperty('email');
        expect(lead).toHaveProperty('estado');
        expect(lead).toHaveProperty('origen');
        expect(lead).toHaveProperty('gestor');
        expect(lead).toHaveProperty('fecha');
      }
    }
  });

  it('lead estados are valid values from the enum', () => {
    for (const id of PROJECT_IDS) {
      for (const lead of LEADS[id]) {
        expect(VALID_ESTADOS).toContain(lead.estado);
      }
    }
  });
});

describe('STATS', () => {
  it('exists for all 6 project IDs', () => {
    for (const id of PROJECT_IDS) {
      expect(STATS[id]).toBeDefined();
      expect(typeof STATS[id]).toBe('object');
    }
  });
});

describe('CAMPAIGNS', () => {
  it('exists for all 6 project IDs with meta and google keys', () => {
    for (const id of PROJECT_IDS) {
      expect(CAMPAIGNS[id]).toBeDefined();
      expect(CAMPAIGNS[id]).toHaveProperty('meta');
      expect(CAMPAIGNS[id]).toHaveProperty('google');
      expect(Array.isArray(CAMPAIGNS[id].meta)).toBe(true);
      expect(Array.isArray(CAMPAIGNS[id].google)).toBe(true);
    }
  });
});

describe('REVENUE_MONTHLY', () => {
  it('exists for all 6 project IDs', () => {
    for (const id of PROJECT_IDS) {
      expect(REVENUE_MONTHLY[id]).toBeDefined();
      expect(Array.isArray(REVENUE_MONTHLY[id])).toBe(true);
      expect(REVENUE_MONTHLY[id].length).toBeGreaterThan(0);
    }
  });
});

describe('CONVERSIONS', () => {
  it('exists for all 6 project IDs', () => {
    for (const id of PROJECT_IDS) {
      expect(CONVERSIONS[id]).toBeDefined();
      expect(Array.isArray(CONVERSIONS[id])).toBe(true);
      expect(CONVERSIONS[id].length).toBeGreaterThan(0);
    }
  });
});
