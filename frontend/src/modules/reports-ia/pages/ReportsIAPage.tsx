import { Link } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Sparkle, ChartBar } from '@phosphor-icons/react';
import ReportsIAView from '../components/ReportsIAView';

/**
 * Página dedicada de Análisis IA, para cualquier campus.
 *
 * Antes solo dejaba entrar a los proyectos «de tipo IA» (Psicólogo IA,
 * Nutricionista IA, Tarot IA), que no están dados de alta, así que nadie podía
 * generar un informe (#216). El servidor nunca tuvo esa restricción, y el
 * informe sale de los leads, las ventas y los UTM del campus.
 */
export default function ReportsIAPage() {
  const { activeProject } = useProjectContext();

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

      {!activeProject ? (
        <EmptyState
          icon={Sparkle}
          title="Elige un campus"
          description="El informe se hace con los datos de un campus. Elígelo en la barra superior."
          action={
            <Link
              to="/informes"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <ChartBar size={14} weight="bold" /> Ver reportes CRM
            </Link>
          }
        />
      ) : (
        <ReportsIAView project={activeProject} />
      )}
    </div>
  );
}
