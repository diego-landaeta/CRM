import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import { useCampaigns } from '../hooks/useCampaigns';
import { PeriodSelector, ConsolidatedView } from '../components/shared';

/**
 * Vista consolidada Meta + Google (CRM-104).
 * Sub-rutas: /campaigns/meta y /campaigns/google
 */
export default function CampaignsPage() {
  const { activeProject } = useProjectContext();
  const all = useCampaigns(activeProject?.id);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Campañas Publicitarias"
        subtitle={activeProject ? `${activeProject.nombre} — Vista consolidada Meta + Google` : 'Selecciona un proyecto'}
      />

      <PeriodSelector all={all} />

      {all.loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <ConsolidatedView data={all.consolidated} project={activeProject} />
      )}
    </div>
  );
}
