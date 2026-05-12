import { Link } from 'react-router-dom';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { ChatCircleText, Sparkle, FileText } from '@phosphor-icons/react';

/**
 * Placeholder de la sección Chat con IA.
 * El backend (POST /api/claude/chat con SSE) ya está listo y la api/hook
 * del módulo (useClaudeChat) están implementados — solo falta la UI.
 *
 * Cuando se construya el panel de chat real, reemplazar este placeholder.
 */
export default function AIChatPage() {
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Chat con Claude AI"
        subtitle="Pregunta a Claude sobre los datos del CRM"
      />

      <EmptyState
        icon={ChatCircleText}
        title="Próximamente"
        description="El chat con Claude para consultas en lenguaje natural sobre tus leads, conversiones y métricas está en construcción. El backend ya está listo (streaming vía SSE) — pendiente la interfaz."
      />

      <section className="grid gap-3 sm:grid-cols-2 max-w-3xl">
        <article className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <Sparkle size={18} weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm">Análisis IA mensual</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mientras tanto, los reportes generados con Claude AI ya están disponibles para proyectos IA.
            </p>
            <Link
              to="/reports/ia"
              className="inline-block mt-2 text-xs text-primary font-medium hover:underline"
            >
              Ver Análisis IA →
            </Link>
          </div>
        </article>

        <article className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <FileText size={18} weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm">Reportes CRM</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Las métricas y dashboards tradicionales del CRM siguen activos.
            </p>
            <Link
              to="/reports"
              className="inline-block mt-2 text-xs text-primary font-medium hover:underline"
            >
              Ver Reportes →
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
