import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';

export function useDashboard() {
  const { activeProject } = useProjectContext();
  const pid = activeProject?.id;

  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch stats y leads recientes en paralelo
      const [statsRes, leadsRes] = await Promise.all([
        client.get(`/leads/stats?projectId=${pid}`),
        client.get(`/leads?projectId=${pid}&limit=5&page=1`),
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (leadsRes.success) {
        setRecentLeads(leadsRes.data || []);
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

  // Construir KPIs desde stats de la API
  const s = stats || {};
  const kpis = {
    leadsNuevos: { value: s.nuevo || 0, change: '--', trend: 'up' },
    conversiones: { value: s.convertido || 0, rate: s.total > 0 ? `${Math.round((s.convertido / s.total) * 100)}%` : '0%', trend: 'up' },
    ingresosMes: { value: s.ingresosMes || 0, change: '--', trend: 'up' },
    tasaAbandono: { value: s.tasaAbandono || 0, change: '--', trend: 'down' },
  };

  return {
    kpis,
    leadsSemana: [], // No hay endpoint de leads por semana aun
    conversionProyecto: [], // No hay endpoint de conversion por proyecto aun
    leadsRecientes: recentLeads,
    stats: s,
    loading,
    error,
  };
}
