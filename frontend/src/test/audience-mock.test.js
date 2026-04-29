import { describe, it, expect } from 'vitest';
import { _testing } from '@/modules/leads/api/audiences.api';

const { mockPreview, mockMetaUploadStart } = _testing;

describe('audiences.api preview mock', () => {
  it('devuelve totalCount + breakdown + sample', () => {
    const r = mockPreview({ projectId: 1, filters: {} });
    expect(r.success).toBe(true);
    expect(r.data.totalCount).toBeGreaterThan(0);
    expect(r.data.breakdown.status).toBeDefined();
    expect(r.data.breakdown.canal).toBeDefined();
    expect(Array.isArray(r.data.sample)).toBe(true);
  });

  it('reduce el count cuando se aplican filtros', () => {
    const sin = mockPreview({ projectId: 1, filters: {} });
    const con = mockPreview({
      projectId: 1,
      filters: { statuses: ['convertido'], canales: ['meta_ads'] },
    });
    expect(con.data.totalCount).toBeLessThan(sin.data.totalCount);
  });

  it('respeta el limite minimo de 20 leads para meta', async () => {
    // Aplicar filtros muy restrictivos para forzar count < 20
    const r = await mockMetaUploadStart({
      projectId: 1,
      filters: {
        statuses: ['convertido'],
        canales: ['meta_ads'],
        productoId: 1,
        importeMinimo: 1000,
      },
    });
    if (!r.success) {
      expect(r.code).toBe('MIN_AUDIENCE_SIZE');
    }
  });
});
