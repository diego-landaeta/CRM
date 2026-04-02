import { describe, it, expect } from 'vitest';
import { leadSchema, ORIGEN_OPTIONS, ESTADO_OPTIONS, PAIS_OPTIONS } from '@/modules/leads/validation/lead.schema';

describe('leadSchema', () => {
  const validLead = {
    nombre: 'Maria Garcia',
    email: 'maria@gmail.com',
    origen: 'meta_ads',
  };

  it('valid lead passes', () => {
    const result = leadSchema.safeParse(validLead);
    expect(result.success).toBe(true);
  });

  it('missing nombre fails', () => {
    const result = leadSchema.safeParse({ ...validLead, nombre: undefined });
    expect(result.success).toBe(false);
  });

  it('invalid email fails', () => {
    const result = leadSchema.safeParse({ ...validLead, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('valid estado values pass', () => {
    const estados = ['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado'];
    for (const estado of estados) {
      const result = leadSchema.safeParse({ ...validLead, estado });
      expect(result.success).toBe(true);
    }
  });

  it('invalid estado fails', () => {
    const result = leadSchema.safeParse({ ...validLead, estado: 'invalid_estado' });
    expect(result.success).toBe(false);
  });

  it('empty optional fields pass', () => {
    const result = leadSchema.safeParse({
      ...validLead,
      telefono: undefined,
      producto_interes: undefined,
      pais: undefined,
      notas: undefined,
      estado: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('ORIGEN_OPTIONS', () => {
  it('has 5 items', () => {
    expect(ORIGEN_OPTIONS).toHaveLength(5);
  });
});

describe('ESTADO_OPTIONS', () => {
  it('has 6 items', () => {
    expect(ESTADO_OPTIONS).toHaveLength(6);
  });
});

describe('PAIS_OPTIONS', () => {
  it('has 22 items', () => {
    expect(PAIS_OPTIONS).toHaveLength(22);
  });
});
