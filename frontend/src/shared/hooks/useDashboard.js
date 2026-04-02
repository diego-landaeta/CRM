import { useProjectContext } from '@/contexts/ProjectContext';
import { STATS, LEADS_SEMANA, LEADS, PROJECTS } from '@/shared/data/mock';

export function useDashboard() {
  const { activeProject } = useProjectContext();
  const pid = activeProject.id;
  const stats = STATS[pid] || {};
  const leads = LEADS[pid] || [];

  const conversionProyecto = PROJECTS.map((p) => ({
    name: p.nombre,
    value: STATS[p.id]?.tasaConversion || 0,
    color: ['#4361ee', '#059669', '#d97706', '#7c3aed', '#0891b2', '#e11d48'][p.id - 1],
  }));

  return {
    kpis: {
      leadsNuevos: { value: stats.nuevo || 0, change: '+12%', trend: 'up' },
      conversiones: { value: stats.convertido || 0, rate: `${stats.tasaConversion || 0}%`, trend: 'up' },
      ingresosMes: { value: stats.ingresosMes || 0, change: '+8%', trend: 'up' },
      tasaAbandono: { value: stats.tasaAbandono || 0, change: `+${stats.tasaAbandono > 5 ? '1.2' : '0.5'}%`, trend: 'down' },
    },
    leadsSemana: LEADS_SEMANA[pid] || [],
    conversionProyecto,
    leadsRecientes: leads.slice(0, 5),
    loading: false,
  };
}
