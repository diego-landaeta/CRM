import { useState, useEffect, useCallback, useMemo } from 'react';
import { listUsers, type CrmUser } from '../api/users.api';
import { accessStateOf, roleKeyOf, type AccessState } from '../lib/usersUi';

/** Cuantos usuarios trae una peticion. El backend no admite mas de 100. */
export const MAX_POR_PETICION = 100;
export const POR_PAGINA = 15;

export type EstadoFiltro = 'todos' | AccessState;
export type RolFiltro = 'todos' | string;

export interface UsersFilters {
  /** Texto libre: busca en nombre y en email. */
  search: string;
  role: RolFiltro;
  estado: EstadoFiltro;
}

const FILTROS_INICIALES: UsersFilters = { search: '', role: 'todos', estado: 'todos' };

export interface UsersError {
  mensaje: string;
  /** Codigo HTTP, cuando el fallo viene del servidor. 403 = sin permiso. */
  status?: number;
}

/**
 * Estado de la pantalla de Usuarios.
 *
 * El filtrado y la paginacion son en cliente a proposito: el endpoint de
 * usuarios no admite busqueda por texto, asi que buscar en el servidor
 * significaria buscar solo dentro de la pagina que se esta viendo — que es
 * peor que no tener buscador. Con menos de 100 usuarios se filtra sobre todo lo
 * cargado y el resultado es el que se espera. Si algun dia se pasa de 100, la
 * pantalla lo avisa (`truncado`) en vez de mentir por lo bajo.
 */
export default function useUsers(projectId?: number) {
  const [todos, setTodos] = useState<CrmUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UsersError | null>(null);
  const [filters, setFilters] = useState<UsersFilters>(FILTROS_INICIALES);
  const [page, setPage] = useState(1);

  const recargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users, total: t } = await listUsers({ projectId, limit: MAX_POR_PETICION });
      setTodos(users);
      setTotal(t);
    } catch (err: any) {
      // client.js lanza ApiError con .status; conservarlo permite separar
      // «el servidor se ha caido» de «no tienes permiso», que no se arreglan igual.
      setError({ mensaje: err?.message || 'Error desconocido', status: err?.status });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { recargar(); }, [recargar]);

  // Cambiar de filtro y quedarse en la pagina 7 deja la tabla en blanco.
  useEffect(() => { setPage(1); }, [filters.search, filters.role, filters.estado, projectId]);

  const setFilter = useCallback(<K extends keyof UsersFilters>(key: K, value: UsersFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const limpiarFiltros = useCallback(() => setFilters(FILTROS_INICIALES), []);

  const filtrados = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return todos.filter((u) => {
      if (filters.role !== 'todos' && roleKeyOf(u) !== filters.role) return false;
      if (filters.estado !== 'todos' && accessStateOf(u) !== filters.estado) return false;
      if (q && !`${u.nombre} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [todos, filters]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(page, totalPaginas);
  const visibles = useMemo(
    () => filtrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA),
    [filtrados, paginaSegura],
  );

  return {
    /** Los de la pagina actual, ya filtrados. */
    visibles,
    /** Cuantos pasan el filtro (todas las paginas). */
    totalFiltrados: filtrados.length,
    /** Cuantos se han cargado. */
    cargados: todos.length,
    /** Cuantos hay en el servidor. */
    total,
    /** El servidor tiene mas de los que caben en una peticion. */
    truncado: total > todos.length,
    hayFiltroActivo: filters.search !== '' || filters.role !== 'todos' || filters.estado !== 'todos',
    loading,
    error,
    recargar,
    filters,
    setFilter,
    limpiarFiltros,
    page: paginaSegura,
    setPage,
    totalPaginas,
    porPagina: POR_PAGINA,
  };
}
