import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';

// Normaliza un lead del listado: backend devuelve `status` y `canal_detectado`
function normalizeLead(lead) {
  if (!lead) return lead;
  return {
    ...lead,
    estado: lead.status || lead.estado,
    origen: lead.canal_detectado || lead.origen || 'directo',
  };
}

// El backend devuelve plurales (nuevos, contactados, ...) — convertir a singulares
function normalizeStats(raw) {
  const d = raw || {};
  const total = Number(d.total) || 0;
  const convertido = Number(d.convertidos) || 0;
  const noInteresado = Number(d.no_interesados) || 0;
  return {
    total,
    nuevo: Number(d.nuevos) || 0,
    por_contactar: Number(d.por_contactar) || 0,
    contactado: Number(d.contactados) || 0,
    en_seguimiento: Number(d.en_seguimiento) || 0,
    convertido,
    no_interesado: noInteresado,
    conversionRate: total > 0 ? Math.round((convertido / total) * 100) : 0,
    abandonRate: total > 0 ? Math.round((noInteresado / total) * 100) : 0,
  };
}

export function useDashboard() {
  const { activeProject } = useProjectContext();
  const pid = activeProject?.id;

  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!pid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        client.get(`/leads/stats?projectId=${pid}`),
        client.get(`/leads?projectId=${pid}&limit=5&page=1`),
      ]);

      if (statsRes.success) {
        setStats(normalizeStats(statsRes.data));
      }
      if (leadsRes.success) {
        setRecentLeads((leadsRes.data || []).map(normalizeLead));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const s = stats || {};
  const kpis = {
    leadsNuevos: { value: s.nuevo || 0, change: '--', trend: 'up' },
    conversiones: {
      value: s.convertido || 0,
      rate: `${s.conversionRate || 0}%`,
      trend: 'up',
    },
    ingresosMes: { value: '--', change: '--', trend: 'up' },
    tasaAbandono: {
      value: s.no_interesado || 0,
      change: `${s.abandonRate || 0}%`,
      trend: 'down',
    },
  };

  return {
    kpis,
    leadsSemana: [],
    conversionProyecto: [],
    leadsRecientes: recentLeads,
    stats: s,
    loading,
    error,
  };
}
