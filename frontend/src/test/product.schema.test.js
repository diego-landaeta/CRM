import { describe, it, expect } from 'vitest';
import {
  productSchema, paymentLinkSchema, PAYMENT_LINK_TYPES,
} from '@/modules/products/validation/product.schema';

describe('productSchema', () => {
  it('valid product passes', () => {
    const result = productSchema.safeParse({ nombre: 'Curso Psicologia', descripcion: 'Un buen curso' });
    expect(result.success).toBe(true);
  });

  it('missing nombre fails (min 2 chars)', () => {
    const result = productSchema.safeParse({ descripcion: 'Descripcion del producto' });
    expect(result.success).toBe(false);
  });

  it('1-char nombre fails', () => {
    const result = productSchema.safeParse({ nombre: 'A' });
    expect(result.success).toBe(false);
  });

  it('empty descripcion passes (optional)', () => {
    const result = productSchema.safeParse({ nombre: 'Producto valido' });
    expect(result.success).toBe(true);
  });
});

describe('paymentLinkSchema (CRM-140)', () => {
  it('expone exactamente 4 tipos', () => {
    const tipos = PAYMENT_LINK_TYPES.map((t) => t.value);
    expect(tipos).toEqual(['completo', 'dos_cuotas', 'tres_cuotas', 'personalizado']);
  });

  it('valida un link bien formado', () => {
    const r = paymentLinkSchema.safeParse({
      label: 'Pago único',
      url: 'https://buy.stripe.com/abc123',
      tipo: 'completo',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza label vacío', () => {
    const r = paymentLinkSchema.safeParse({
      label: '',
      url: 'https://buy.stripe.com/abc',
      tipo: 'completo',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza URL inválida', () => {
    const r = paymentLinkSchema.safeParse({
      label: 'Test',
      url: 'no-es-una-url',
      tipo: 'completo',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza tipo no permitido', () => {
    const r = paymentLinkSchema.safeParse({
      label: 'Test',
      url: 'https://example.com/pay',
      tipo: 'cuatro_cuotas',
    });
    expect(r.success).toBe(false);
  });

  it('acepta los 4 tipos válidos', () => {
    for (const { value } of PAYMENT_LINK_TYPES) {
      const r = paymentLinkSchema.safeParse({
        label: `Pago ${value}`,
        url: 'https://example.com/pay',
        tipo: value,
      });
      expect(r.success).toBe(true);
    }
  });
});
