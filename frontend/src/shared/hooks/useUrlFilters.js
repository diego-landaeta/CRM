import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sincroniza estado de filtros con URL search params.
 * Permite que refresh, copy/paste de URL y back/forward conserven el estado.
 *
 * Uso:
 *   const [filters, setFilters] = useUrlFilters({
 *     status: 'all',
 *     from: '',
 *     responsable: '',
 *   });
 *   filters.status              // valor actual (string)
 *   setFilters({ status: 'nuevo' })  // patch parcial; se omite del URL si === default
 *   setFilters.reset()          // limpia todos los params
 *
 * Convenciones:
 *  - Solo strings y números primitivos. Para arrays: serialízalos como CSV ("a,b,c").
 *  - Valor === default → no aparece en la URL (URLs limpias).
 *  - Cambios via setFilters() reemplazan el history entry actual (replace=true) — refresh-safe.
 */
export default function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado actual leído del URL, con defaults
  const filters = useMemo(() => {
    const out = {};
    for (const [key, def] of Object.entries(defaults)) {
      const fromUrl = searchParams.get(key);
      if (fromUrl == null) {
        out[key] = def;
      } else if (typeof def === 'number') {
        const n = Number(fromUrl);
        out[key] = Number.isFinite(n) ? n : def;
      } else {
        out[key] = fromUrl;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, JSON.stringify(defaults)]);

  // Setter parcial: aplica patch y omite los que igualan default
  const setFilters = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const merged = { ...filters, ...patch };
      for (const [key, def] of Object.entries(defaults)) {
        const value = merged[key];
        const isDefault = value === def || value === '' || value == null;
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      return next;
    }, { replace: true });
  }, [filters, setSearchParams, defaults]);

  setFilters.reset = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of Object.keys(defaults)) next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams, defaults]);

  return [filters, setFilters];
}
