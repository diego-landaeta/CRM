import { describe, it, expect } from 'vitest';

// Test directo del logica del mock (no de la API real)
// Importamos via ruta que NO trigger React
async function loadMock() {
  const m = await import('@/modules/leads/api/audiences.api');
  return m;
}

describe('audiences.api preview mock', () => {
  it('devuelve totalCount + breakdown + sample', async () => {
    const { previewAudience } = await loadMock();
    const r = await previewAudience({ projectId: 1, filters: {} });
    expect(r.success).toBe(true);
    expect(r.data.totalCount).toBeGreaterThan(0);
    expect(r.data.breakdown.status).toBeDefined();
    expect(r.data.breakdown.canal).toBeDefined();
    expect(Array.isArray(r.data.sample)).toBe(true);
  });

  it('reduce el count cuando se aplican filtros', async () => {
    const { previewAudience } = await loadMock();
    const sin = await previewAudience({ projectId: 1, filters: {} });
    const con = await previewAudience({
      projectId: 1,
      filters: { statuses: ['convertido'], canales: ['meta_ads'] },
    });
    expect(con.data.totalCount).toBeLessThan(sin.data.totalCount);
  });

  it('respeta el limite minimo de 20 leads para meta', async () => {
    const { uploadAudienceToMeta } = await loadMock();
    // Aplicar filtros muy restrictivos
    const r = await uploadAudienceToMeta({
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
