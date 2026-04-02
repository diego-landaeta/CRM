import { describe, it, expect } from 'vitest';
import { productSchema } from '@/modules/products/validation/product.schema';

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
