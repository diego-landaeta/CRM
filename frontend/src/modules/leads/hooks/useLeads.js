import { useState, useMemo } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { LEADS, STATS } from '@/shared/data/mock';

const PAGE_SIZE = 6;

export function useLeads() {
  const { activeProject } = useProjectContext();
  const pid = activeProject.id;
  const allLeads = LEADS[pid] || [];
  const stats = STATS[pid] || {};

  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return allLeads.filter((lead) => {
      const matchSearch = !search ||
        lead.nombre.toLowerCase().includes(search.toLowerCase()) ||
        lead.email.toLowerCase().includes(search.toLowerCase());
      const matchEstado = !filterEstado || lead.estado === filterEstado;
      const matchOrigen = !filterOrigen || lead.origen === filterOrigen;
      return matchSearch && matchEstado && matchOrigen;
    });
  }, [allLeads, search, filterEstado, filterOrigen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return {
    leads: paginated,
    stats,
    total: filtered.length,
    page: safePage,
    totalPages,
    setPage,
    search,
    setSearch,
    filterEstado,
    setFilterEstado,
    filterOrigen,
    setFilterOrigen,
    loading: false,
  };
}

export function useLeadDetail(id) {
  const { activeProject } = useProjectContext();
  const allLeads = LEADS[activeProject.id] || [];
  const lead = allLeads.find((l) => l.id === Number(id));

  const timeline = lead ? [
    { id: 1, action: 'Lead creado via webhook', date: `${lead.fecha}, 14:32`, source: 'Sistema', color: '#4361ee' },
    { id: 2, action: 'Email de bienvenida enviado', date: `${lead.fecha}, 14:32`, source: 'Brevo', color: '#059669' },
    { id: 3, action: `Asignado a ${lead.gestor} (round-robin)`, date: `${lead.fecha}, 14:33`, source: 'Sistema', color: '#d97706' },
  ] : [];

  const interacciones = lead?.interacciones || [];
  const recordatorio = lead?.recordatorio || null;

  return { lead, timeline, interacciones, recordatorio, loading: false };
}
