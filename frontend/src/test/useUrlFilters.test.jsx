import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import useUrlFilters from '@/shared/hooks/useUrlFilters';

function wrapperFor(initialEntries) {
  return ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

describe('useUrlFilters', () => {
  it('devuelve los defaults si la URL no tiene params', () => {
    const { result } = renderHook(
      () => useUrlFilters({ status: 'all', from: '', limit: 20 }),
      { wrapper: wrapperFor(['/']) },
    );
    const [filters] = result.current;
    expect(filters).toEqual({ status: 'all', from: '', limit: 20 });
  });

  it('lee strings desde la URL', () => {
    const { result } = renderHook(
      () => useUrlFilters({ status: 'all', search: '' }),
      { wrapper: wrapperFor(['/?status=nuevo&search=ana']) },
    );
    const [filters] = result.current;
    expect(filters.status).toBe('nuevo');
    expect(filters.search).toBe('ana');
  });

  it('coacciona a Number si el default es numérico', () => {
    const { result } = renderHook(
      () => useUrlFilters({ page: 1, limit: 20 }),
      { wrapper: wrapperFor(['/?page=5&limit=50']) },
    );
    const [filters] = result.current;
    expect(filters.page).toBe(5);
    expect(filters.limit).toBe(50);
    expect(typeof filters.page).toBe('number');
  });

  it('si la URL trae valor no-numérico para un default numérico, cae al default', () => {
    const { result } = renderHook(
      () => useUrlFilters({ page: 1 }),
      { wrapper: wrapperFor(['/?page=abc']) },
    );
    expect(result.current[0].page).toBe(1);
  });

  it('setFilters actualiza valores en la URL', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ status: 'all', search: '' });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/']) });

    act(() => { result.current.setFilters({ status: 'nuevo' }); });

    expect(result.current.filters.status).toBe('nuevo');
    expect(result.current.search).toContain('status=nuevo');
  });

  it('setFilters omite del URL los valores que igualan al default', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ status: 'all', limit: 20 });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/?status=nuevo']) });

    expect(result.current.search).toContain('status=nuevo');

    act(() => { result.current.setFilters({ status: 'all' }); });

    // Ya no debe estar en la URL
    expect(result.current.search).not.toContain('status=');
    // Pero el filtro vuelve al default
    expect(result.current.filters.status).toBe('all');
  });

  it('valor "" se trata como default y se omite del URL', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ search: '' });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/?search=ana']) });

    act(() => { result.current.setFilters({ search: '' }); });
    expect(result.current.search).not.toContain('search=');
  });

  it('reset() limpia todos los params controlados', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ status: 'all', search: '' });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/?status=nuevo&search=ana']) });
    expect(result.current.search).toContain('status=nuevo');
    expect(result.current.search).toContain('search=ana');

    act(() => { result.current.setFilters.reset(); });

    expect(result.current.search).not.toContain('status=');
    expect(result.current.search).not.toContain('search=');
    expect(result.current.filters).toEqual({ status: 'all', search: '' });
  });

  it('setFilters parcial: actualiza solo lo que se pasa, mantiene el resto', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ status: 'all', search: '' });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/?status=nuevo']) });

    act(() => { result.current.setFilters({ search: 'ana' }); });

    expect(result.current.filters.status).toBe('nuevo');
    expect(result.current.filters.search).toBe('ana');
  });

  it('preserva params NO controlados (que no están en defaults)', () => {
    function Probe() {
      const [filters, setFilters] = useUrlFilters({ status: 'all' });
      const location = useLocation();
      return { filters, setFilters, search: location.search };
    }
    const { result } = renderHook(() => Probe(), { wrapper: wrapperFor(['/?other=keep']) });

    act(() => { result.current.setFilters({ status: 'nuevo' }); });

    expect(result.current.search).toContain('other=keep');
    expect(result.current.search).toContain('status=nuevo');
  });
});
