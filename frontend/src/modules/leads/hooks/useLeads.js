import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import useUrlFilters from '@/shared/hooks/useUrlFilters';
import client from '@/shared/api/client';

const PAGE_SIZE = 20;

// Defaults para filtros persistidos en URL.
// Solo valores != default aparecen en la URL — refresh-safe + URL compartible.
const URL_DEFAULTS = {
  q: '',          // search
  estado: '',     // filterEstado
  origen: '',     // filterOrigen
  resp: '',       // filterResponsable
  page: 1,
};

// Normaliza la respuesta del backend para mantener compatibilidad con la UI.
// El backend devuelve `status` y `canal_detectado`, la UI usa `estado` y `origen`.
function normalizeLead(lead) {
  if (!lead) return lead;
  return {
    ...lead,
    estado: lead.status || lead.estado,
    origen: lead.canal_detectado || lead.origen || 'directo',
  };
}

export function useLeads() {
  const { activeProject } = useProjectContext();
  const pid = activeProject?.id;

  // Filtros sincronizados con URL — refresh y compartir mantienen el estado.
  const [urlFilters, setUrlFilters] = useUrlFilters(URL_DEFAULTS);
  const { q: search, estado: filterEstado, origen: filterOrigen, resp: filterResponsable, page } = urlFilters;

  // Setters compatibles con la API anterior (string -> nuevo valor)
  const setSearch = useCallback((v) => setUrlFilters({ q: v, page: 1 }), [setUrlFilters]);
  const setFilterEstado = useCallback((v) => setUrlFilters({ estado: v, page: 1 }), [setUrlFilters]);
  const setFilterOrigen = useCallback((v) => setUrlFilters({ origen: v, page: 1 }), [setUrlFilters]);
  const setFilterResponsable = useCallback((v) => setUrlFilters({ resp: v, page: 1 }), [setUrlFilters]);
  const setPage = useCallback((v) => {
    const next = typeof v === 'function' ? v(page) : v;
    setUrlFilters({ page: Number(next) || 1 });
  }, [page, setUrlFilters]);

  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce para search (350ms)
  const searchTimerRef = useRef(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // AbortController para cancelar requests en vuelo cuando los filtros
  // cambian rápido (typing en el search, paginación rápida). Sin esto,
  // una respuesta vieja podía pisar a una nueva = race condition.
  const abortRef = useRef(null);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    if (!pid) return;
    // Cancelar request anterior si sigue en vuelo
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('projectId', pid);
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterEstado) params.set('status', filterEstado);
      if (filterOrigen) params.set('canal', filterOrigen);
      if (filterResponsable) params.set('responsableId', filterResponsable);

      const res = await client.get(`/leads?${params.toString()}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.success) {
        setLeads((res.data || []).map(normalizeLead));
        if (res.pagination) {
          setTotal(res.pagination.total || 0);
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      // Ignorar errores por abort (es esperado al cancelar)
      if (err.name === 'AbortError') return;
      setError(err.message);
      setLeads([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [pid, page, debouncedSearch, filterEstado, filterOrigen, filterResponsable]);

  // Cleanup al desmontar
  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!pid) return;
    try {
      const res = await client.get(`/leads/stats?projectId=${pid}`);
      if (res.success) {
        // Backend devuelve nuevos, contactados, etc — mapear a singular
        const d = res.data || {};
        setStats({
          total: Number(d.total) || 0,
          nuevo: Number(d.nuevos) || 0,
          por_contactar: Number(d.por_contactar) || 0,
          contactado: Number(d.contactados) || 0,
          en_seguimiento: Number(d.en_seguimiento) || 0,
          convertido: Number(d.convertidos) || 0,
          no_interesado: Number(d.no_interesados) || 0,
        });
      }
    } catch {
      // Stats son secundarios, no bloquear UI
    }
  }, [pid]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    leads,
    stats,
    total,
    page,
    totalPages,
    setPage,
    search,
    setSearch,
    filterEstado,
    setFilterEstado,
    filterOrigen,
    setFilterOrigen,
    filterResponsable,
    setFilterResponsable,
    loading,
    error,
    refetch: fetchLeads,
  };
}

export function useLeadDetail(id) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/leads/${id}`);
      if (res.success) {
        setLead(normalizeLead(res.data));
      }
    } catch (err) {
      setError(err.message);
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // Datos del lead
  const interacciones = lead?.interactions || [];
  const reminders = lead?.reminders || [];
  const recordatorio = reminders[0] || null;
  const utms = lead?.utms || null;
  const statusHistory = lead?.statusHistory || [];

  // Construir timeline del sistema desde history
  const timeline = statusHistory.map((h, i) => ({
    id: h.id || i,
    action: `Estado cambiado a ${h.status_nuevo}${h.changed_by_nombre ? ' por ' + h.changed_by_nombre : ''}`,
    date: h.changed_at ? new Date(h.changed_at).toLocaleString('es-ES') : '',
    source: 'Sistema',
    color: ['#4361ee', '#059669', '#d97706', '#7c3aed'][i % 4],
  }));

  if (timeline.length === 0 && lead) {
    timeline.push({
      id: 1,
      action: 'Lead creado',
      date: lead.created_at ? new Date(lead.created_at).toLocaleString('es-ES') : '',
      source: 'Sistema',
      color: '#4361ee',
    });
  }

  // Funciones de accion
  const updateStatus = useCallback(async (status, motivo) => {
    const body = { status };
    if (motivo) body.motivo = motivo;
    const res = await client.patch(`/leads/${id}/status`, body);
    if (res.success) await fetchLead();
    return res;
  }, [id, fetchLead]);

  const addInteraction = useCallback(async (tipo, nota, fecha) => {
    const res = await client.post(`/leads/${id}/interactions`, { tipo, nota, fecha: fecha || undefined });
    if (res.success) await fetchLead();
    return res;
  }, [id, fetchLead]);

  const addReminder = useCallback(async (fecha_recordatorio, nota) => {
    const res = await client.post(`/leads/${id}/reminders`, { fecha_recordatorio, nota });
    if (res.success) await fetchLead();
    return res;
  }, [id, fetchLead]);

  const completeReminder = useCallback(async (reminderId) => {
    const res = await client.patch(`/leads/reminders/${reminderId}/complete`);
    if (res.success) await fetchLead();
    return res;
  }, [fetchLead]);

  const reassign = useCallback(async (responsable_id) => {
    const res = await client.patch(`/leads/${id}/reassign`, { responsable_id });
    if (res.success) await fetchLead();
    return res;
  }, [id, fetchLead]);

  const updateLead = useCallback(async (fields) => {
    const res = await client.patch(`/leads/${id}`, fields);
    if (res.success) await fetchLead();
    return res;
  }, [id, fetchLead]);

  return {
    lead,
    timeline,
    interacciones,
    reminders,
    recordatorio,
    utms,
    statusHistory,
    loading,
    error,
    refetch: fetchLead,
    updateStatus,
    addInteraction,
    addReminder,
    completeReminder,
    reassign,
    updateLead,
  };
}
