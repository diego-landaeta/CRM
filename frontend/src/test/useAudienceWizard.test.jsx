import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock de la API antes de importar el hook
vi.mock('@/modules/leads/api/audiences.api', () => ({
  previewAudience: vi.fn(),
  exportAudienceCsv: vi.fn(),
}));

import { useAudienceWizard, MIN_AUDIENCE_SIZE } from '@/modules/leads/hooks/useAudienceWizard';
import { previewAudience, exportAudienceCsv } from '@/modules/leads/api/audiences.api';

const samplePreview = {
  totalCount: 120,
  breakdown: { status: { nuevo: 50 }, canal: { meta_ads: 70 } },
  sample: [{ id: 1, nombre: 'Ana', email: 'a@a.com', telefono: '600', estado: 'nuevo', canal: 'meta_ads' }],
};

describe('useAudienceWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewAudience.mockResolvedValue({ success: true, data: samplePreview });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('arranca en step 0 con filtros default vacíos', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    expect(result.current.step).toBe(0);
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.canales).toEqual([]);
    expect(result.current.filters.productoId).toBeNull();
    expect(result.current.filters.importeMinimo).toBeNull();
  });

  it('toggleStatus añade y quita un status', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    act(() => result.current.toggleStatus('nuevo'));
    expect(result.current.filters.statuses).toEqual(['nuevo']);
    act(() => result.current.toggleStatus('nuevo'));
    expect(result.current.filters.statuses).toEqual([]);
  });

  it('toggleCanal añade y quita un canal', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    act(() => result.current.toggleCanal('meta_ads'));
    act(() => result.current.toggleCanal('google_ads'));
    expect(result.current.filters.canales).toEqual(['meta_ads', 'google_ads']);
    act(() => result.current.toggleCanal('meta_ads'));
    expect(result.current.filters.canales).toEqual(['google_ads']);
  });

  it('setFilter aplica patches parciales sin pisar el resto', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    act(() => result.current.toggleStatus('nuevo'));
    act(() => result.current.setFilter({ fechaDesde: '2026-01-01' }));
    expect(result.current.filters.statuses).toEqual(['nuevo']);
    expect(result.current.filters.fechaDesde).toBe('2026-01-01');
  });

  it('resetFilters vuelve a defaults', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    act(() => result.current.toggleStatus('nuevo'));
    act(() => result.current.setFilter({ importeMinimo: 500 }));
    act(() => result.current.resetFilters());
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.importeMinimo).toBeNull();
  });

  it('next/prev/goTo limitan el step a [0,2]', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    act(() => result.current.next()); expect(result.current.step).toBe(1);
    act(() => result.current.next()); expect(result.current.step).toBe(2);
    act(() => result.current.next()); expect(result.current.step).toBe(2);
    act(() => result.current.prev()); expect(result.current.step).toBe(1);
    act(() => result.current.prev()); expect(result.current.step).toBe(0);
    act(() => result.current.prev()); expect(result.current.step).toBe(0);
    act(() => result.current.goTo(5)); expect(result.current.step).toBe(2);
    act(() => result.current.goTo(-1)); expect(result.current.step).toBe(0);
  });

  it('genera filename con slug + fecha ISO', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    expect(result.current.filename).toMatch(/^audiencia_iseih_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('filename sanitiza caracteres no válidos del slug', () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'mi proyecto / 2026!'));
    expect(result.current.filename).toMatch(/^audiencia_mi-proyecto---2026-_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('filename usa "proyecto" si no hay slug', () => {
    const { result } = renderHook(() => useAudienceWizard(1, null));
    expect(result.current.filename).toMatch(/^audiencia_proyecto_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('meetsMinimum es true cuando totalCount >= MIN_AUDIENCE_SIZE', async () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(result.current.totalCount).toBe(120));
    expect(result.current.meetsMinimum).toBe(true);
    expect(MIN_AUDIENCE_SIZE).toBe(20);
  });

  it('meetsMinimum es false cuando totalCount < MIN_AUDIENCE_SIZE', async () => {
    previewAudience.mockResolvedValue({ success: true, data: { ...samplePreview, totalCount: 10 } });
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(result.current.totalCount).toBe(10));
    expect(result.current.meetsMinimum).toBe(false);
  });

  it('llama previewAudience al cambiar filtros (con debounce)', async () => {
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(previewAudience).toHaveBeenCalled());
    const callsAntes = previewAudience.mock.calls.length;
    act(() => result.current.toggleStatus('nuevo'));
    await waitFor(() => expect(previewAudience.mock.calls.length).toBeGreaterThan(callsAntes));
  });

  it('expone previewError si la API devuelve success:false', async () => {
    previewAudience.mockResolvedValue({ success: false, error: 'Filtros inválidos' });
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(result.current.previewError).toBe('Filtros inválidos'));
  });

  it('downloadCsv falla si no hay projectId', async () => {
    const { result } = renderHook(() => useAudienceWizard(null, 'iseih'));
    let r;
    await act(async () => { r = await result.current.downloadCsv(); });
    expect(r).toBeUndefined();
    expect(exportAudienceCsv).not.toHaveBeenCalled();
  });

  it('downloadCsv no descarga si meetsMinimum=false', async () => {
    previewAudience.mockResolvedValue({ success: true, data: { ...samplePreview, totalCount: 5 } });
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(result.current.totalCount).toBe(5));
    let r;
    await act(async () => { r = await result.current.downloadCsv(); });
    expect(r).toBeUndefined();
    expect(exportAudienceCsv).not.toHaveBeenCalled();
  });

  it('downloadCsv invoca la API con projectId+filters', async () => {
    const fakeBlob = new Blob(['email_hash\nabc'], { type: 'text/csv' });
    exportAudienceCsv.mockResolvedValue(fakeBlob);
    const orig = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    try {
      const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
      await waitFor(() => expect(result.current.totalCount).toBe(120));
      let r;
      await act(async () => { r = await result.current.downloadCsv(); });
      expect(exportAudienceCsv).toHaveBeenCalledWith({ projectId: 1, filters: result.current.filters });
      expect(r.success).toBe(true);
    } finally {
      URL.createObjectURL = orig;
    }
  });

  it('downloadCsv devuelve { success:false, error } si la API tira', async () => {
    exportAudienceCsv.mockRejectedValue(new Error('Network down'));
    const { result } = renderHook(() => useAudienceWizard(1, 'iseih'));
    await waitFor(() => expect(result.current.totalCount).toBe(120));
    let r;
    await act(async () => { r = await result.current.downloadCsv(); });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Network down');
  });

  it('al cambiar projectId resetea step y filtros', async () => {
    const { result, rerender } = renderHook(
      ({ pid }) => useAudienceWizard(pid, 'iseih'),
      { initialProps: { pid: 1 } },
    );
    act(() => result.current.toggleStatus('nuevo'));
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
    rerender({ pid: 2 });
    expect(result.current.step).toBe(0);
    expect(result.current.filters.statuses).toEqual([]);
  });
});
