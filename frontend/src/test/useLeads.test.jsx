import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockProject, mockClient } = vi.hoisted(() => ({
  mockProject: { value: { id: 1, nombre: 'Test', slug: 'test' } },
  mockClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: mockProject.value }),
}));
vi.mock('@/shared/api/client', () => ({ default: mockClient }));

import { useLeads, useLeadDetail } from '@/modules/leads/hooks/useLeads';

const sampleLeadsResponse = {
  success: true,
  data: [
    { id: 1, nombre: 'Ana', email: 'a@a.com', status: 'nuevo', canal_detectado: 'meta_ads' },
    { id: 2, nombre: 'Beto', email: 'b@b.com', status: 'contactado' },
  ],
  pagination: { total: 2, page: 1, totalPages: 1 },
};

const sampleStatsResponse = {
  success: true,
  data: { total: 50, nuevos: 10, contactados: 20, convertidos: 5, en_seguimiento: 8, no_interesados: 2, por_contactar: 5 },
};

const wrapperFor = (initialEntries = ['/']) => ({ children }) => (
  <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
);

describe('useLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProject.value = { id: 1, nombre: 'Test', slug: 'test' };
    mockClient.get.mockImplementation((url) => {
      if (url.includes('/leads/stats')) return Promise.resolve(sampleStatsResponse);
      if (url.startsWith('/leads')) return Promise.resolve(sampleLeadsResponse);
      return Promise.resolve({ success: true, data: [] });
    });
  });

  it('expone defaults de filtros (vacíos)', async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    expect(result.current.search).toBe('');
    expect(result.current.filterEstado).toBe('');
    expect(result.current.filterOrigen).toBe('');
    expect(result.current.filterResponsable).toBe('');
    expect(result.current.page).toBe(1);
  });

  it('carga leads y normaliza status→estado, canal_detectado→origen', async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.leads.length).toBe(2));
    expect(result.current.leads[0].estado).toBe('nuevo');
    expect(result.current.leads[0].origen).toBe('meta_ads');
    expect(result.current.leads[1].estado).toBe('contactado');
    expect(result.current.leads[1].origen).toBe('directo');
  });

  it('mapea stats del backend (nuevos→nuevo, etc)', async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.stats.total).toBe(50));
    expect(result.current.stats.nuevo).toBe(10);
    expect(result.current.stats.contactado).toBe(20);
    expect(result.current.stats.convertido).toBe(5);
    expect(result.current.stats.en_seguimiento).toBe(8);
    expect(result.current.stats.por_contactar).toBe(5);
  });

  it('lee filtros desde la URL', async () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor(['/?q=ana&estado=nuevo&page=2']),
    });
    expect(result.current.search).toBe('ana');
    expect(result.current.filterEstado).toBe('nuevo');
    expect(result.current.page).toBe(2);
  });

  it('setSearch resetea page a 1', async () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor(['/?page=3']),
    });
    expect(result.current.page).toBe(3);
    act(() => result.current.setSearch('hola'));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.search).toBe('hola');
  });

  it('setFilterEstado resetea page a 1', async () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor(['/?page=4']),
    });
    act(() => result.current.setFilterEstado('contactado'));
    await waitFor(() => expect(result.current.filterEstado).toBe('contactado'));
    expect(result.current.page).toBe(1);
  });

  it('setPage soporta función updater', async () => {
    const { result } = renderHook(() => useLeads(), {
      wrapper: wrapperFor(['/?page=2']),
    });
    act(() => result.current.setPage((p) => p + 1));
    await waitFor(() => expect(result.current.page).toBe(3));
  });

  it('NO fetchea si activeProject.id es null', () => {
    mockProject.value = { id: null };
    renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/leads?'));
  });

  it('refetch dispara nueva llamada a API', async () => {
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.leads.length).toBe(2));
    const callsBefore = mockClient.get.mock.calls.filter(c => c[0].startsWith('/leads?')).length;
    await act(async () => { await result.current.refetch(); });
    const callsAfter = mockClient.get.mock.calls.filter(c => c[0].startsWith('/leads?')).length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('error en fetch setea error y leads vacío', async () => {
    mockClient.get.mockImplementation((url) => {
      if (url.startsWith('/leads/stats')) return Promise.resolve(sampleStatsResponse);
      return Promise.reject(new Error('Network down'));
    });
    const { result } = renderHook(() => useLeads(), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.error).toBe('Network down'));
    expect(result.current.leads).toEqual([]);
  });
});

describe('useLeadDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga lead y devuelve normalizado', async () => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { id: 5, nombre: 'X', status: 'nuevo', interactions: [], reminders: [], statusHistory: [], created_at: '2026-01-01T00:00:00Z' },
    });
    const { result } = renderHook(() => useLeadDetail(5), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.lead?.id).toBe(5));
    expect(result.current.lead?.estado).toBe('nuevo');
    expect(result.current.timeline.length).toBe(1);
    expect(result.current.timeline[0].action).toBe('Lead creado');
  });

  it('construye timeline desde statusHistory', async () => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: {
        id: 5,
        nombre: 'X',
        status: 'contactado',
        interactions: [],
        reminders: [],
        statusHistory: [
          { id: 'h1', status_nuevo: 'contactado', changed_by_nombre: 'Ana', changed_at: '2026-01-02T00:00:00Z' },
        ],
        created_at: '2026-01-01T00:00:00Z',
      },
    });
    const { result } = renderHook(() => useLeadDetail(5), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.timeline.length).toBe(1));
    expect(result.current.timeline[0].action).toContain('contactado');
    expect(result.current.timeline[0].action).toContain('Ana');
  });

  it('si id es null/undefined no llama API', () => {
    renderHook(() => useLeadDetail(null), { wrapper: wrapperFor(['/']) });
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it('updateStatus llama PATCH /leads/:id/status y refetcha', async () => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { id: 5, status: 'nuevo', interactions: [], reminders: [], statusHistory: [] },
    });
    mockClient.patch.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useLeadDetail(5), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.lead?.id).toBe(5));
    await act(async () => { await result.current.updateStatus('contactado'); });
    expect(mockClient.patch).toHaveBeenCalledWith('/leads/5/status', { status: 'contactado' });
  });

  it('reassign llama PATCH /leads/:id/reassign con responsable_id', async () => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: { id: 5, interactions: [], reminders: [], statusHistory: [] },
    });
    mockClient.patch.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useLeadDetail(5), { wrapper: wrapperFor(['/']) });
    await waitFor(() => expect(result.current.lead?.id).toBe(5));
    await act(async () => { await result.current.reassign(7); });
    expect(mockClient.patch).toHaveBeenCalledWith('/leads/5/reassign', { responsable_id: 7 });
  });
});
