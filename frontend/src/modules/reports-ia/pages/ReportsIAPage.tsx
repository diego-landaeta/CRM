import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Sparkle, ChartBar } from '@phosphor-icons/react';
import ReportsIAView from '../components/ReportsIAView';

/**
 * Página dedicada de Análisis IA. Disponible solo para proyectos type='ia'.
 * Para proyectos CRM tradicional muestra placeholder con CTA hacia /reports.
 */
export default function ReportsIAPage() {
  const { activeProject } = useProjectContext();
  const isIaProject = activeProject?.type === 'ia';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Análisis IA"
        subtitle={
          activeProject
            ? `Reportes generados con Claude AI · ${activeProject.nombre}`
            : 'Reportes generados con Claude AI'
        }
      />

      {!isIaProject ? (
        <EmptyState
          icon={Sparkle}
          title="Disponible en proyectos IA"
          description="Los reportes con Claude AI solo se generan para proyectos de tipo IA (Psicólogo IA, Nutricionista IA, Tarot IA). Cambia de proyecto en la barra superior para acceder."
          action={
            <a
              href="/crm/reports"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <ChartBar size={14} weight="bold" /> Ver reportes CRM
            </a>
          }
        />
      ) : (
        <ReportsIAView project={activeProject} />
      )}
    </div>
  );
}
