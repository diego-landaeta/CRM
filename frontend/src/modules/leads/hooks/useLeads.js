import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';

const PAGE_SIZE = 20;

export function useLeads() {
  const { activeProject } = useProjectContext();
  const pid = activeProject?.id;

  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('projectId', pid);
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      if (search) params.set('search', search);
      if (filterEstado) params.set('status', filterEstado);
      if (filterOrigen) params.set('origen', filterOrigen);

      const res = await client.get(`/leads?${params.toString()}`);
      if (res.success) {
        setLeads(res.data || []);
        if (res.pagination) {
          setTotal(res.pagination.total || 0);
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      setError(err.message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [pid, page, search, filterEstado, filterOrigen]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!pid) return;
    try {
      const res = await client.get(`/leads/stats?projectId=${pid}`);
      if (res.success) {
        setStats(res.data || {});
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

  // Reset page cuando cambian filtros
  const setSearchAndReset = useCallback((val) => {
    setSearch(val);
    setPage(1);
  }, []);

  return {
    leads,
    stats,
    total,
    page,
    totalPages,
    setPage,
    search,
    setSearch: setSearchAndReset,
    filterEstado,
    setFilterEstado,
    filterOrigen,
    setFilterOrigen,
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
        setLead(res.data);
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

  // Extraer datos del lead
  const interacciones = lead?.interactions || lead?.interacciones || [];
  const recordatorio = lead?.reminders?.[0] || lead?.recordatorio || null;

  // Construir timeline del sistema desde history
  const timeline = (lead?.history || []).map((h, i) => ({
    id: h.id || i,
    action: h.descripcion || h.action || h.description || '',
    date: h.fecha || h.created_at || '',
    source: h.source || 'Sistema',
    color: ['#4361ee', '#059669', '#d97706', '#7c3aed'][i % 4],
  }));

  // Si no hay history, construir uno basico
  if (timeline.length === 0 && lead) {
    timeline.push({
      id: 1,
      action: 'Lead creado',
      date: lead.created_at || lead.fecha || '',
      source: 'Sistema',
      color: '#4361ee',
    });
  }

  // Funciones de accion
  const updateStatus = useCallback(async (status, motivo) => {
    const body = { status };
    if (motivo) body.motivo = motivo;
    const res = await client.patch(`/leads/${id}/status`, body);
    if (res.success) {
      await fetchLead(); // Refrescar datos
    }
    return res;
  }, [id, fetchLead]);

  const addInteraction = useCallback(async (tipo, nota) => {
    const res = await client.post(`/leads/${id}/interactions`, { tipo, nota });
    if (res.success) {
      await fetchLead();
    }
    return res;
  }, [id, fetchLead]);

  const addReminder = useCallback(async (fecha_recordatorio, nota) => {
    const res = await client.post(`/leads/${id}/reminders`, { fecha_recordatorio, nota });
    if (res.success) {
      await fetchLead();
    }
    return res;
  }, [id, fetchLead]);

  const completeReminder = useCallback(async (reminderId) => {
    const res = await client.patch(`/leads/reminders/${reminderId}/complete`);
    if (res.success) {
      await fetchLead();
    }
    return res;
  }, [fetchLead]);

  const reassign = useCallback(async (responsable_id) => {
    const res = await client.patch(`/leads/${id}/reassign`, { responsable_id });
    if (res.success) {
      await fetchLead();
    }
    return res;
  }, [id, fetchLead]);

  return {
    lead,
    timeline,
    interacciones,
    recordatorio,
    loading,
    error,
    refetch: fetchLead,
    updateStatus,
    addInteraction,
    addReminder,
    completeReminder,
    reassign,
  };
}
