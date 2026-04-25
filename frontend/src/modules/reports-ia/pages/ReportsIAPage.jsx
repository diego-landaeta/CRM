import { useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import { useReportsIA } from '../hooks/useReportsIA';
import { exportReportPdf } from '../api/reports-ia.api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkle, FileText, ClockCounterClockwise, FilePdf, Lightning,
  CircleNotch, ArrowClockwise, WarningCircle, Robot,
} from '@phosphor-icons/react';

function fmtPeriodo(p) {
  if (!p) return '';
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function fmtDate(s) {
  return s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

export default function ReportsIAPage() {
  const { user } = useAuth();
  const { activeProject } = useProjectContext();
  const reportsIA = useReportsIA(activeProject?.id);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reportes IA" subtitle="Selecciona un proyecto" />
        <EmptyState icon={Robot} title="Sin proyecto" description="Elige un proyecto del selector lateral" />
      </div>
    );
  }

  async function handleGenerate() {
    try {
      await reportsIA.generate();
      toast({ title: 'Reporte generado', description: 'Claude AI analizo los datos del periodo' });
    } catch (err) {
      toast({ title: 'Error generando reporte', description: err.message, variant: 'destructive' });
    }
  }

  async function handleExportPdf() {
    if (!reportsIA.selected) return;
    setPdfLoading(true);
    try {
      // jsPDF dispara la descarga directamente con el filename correcto
      const slug = (activeProject?.slug || 'proyecto').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const filename = `reporte-${slug}-${reportsIA.selected.periodo}.pdf`;
      await exportReportPdf(reportsIA.selected.id, { filename });
      toast({ title: 'PDF descargado', description: filename });
    } catch (err) {
      toast({ title: 'Error generando PDF', description: err.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Reportes IA"
        subtitle={`${activeProject.nombre} — Reportes mensuales generados por Claude AI`}
        actions={isAdmin && (
          <>
            <button
              onClick={handleGenerate}
              disabled={reportsIA.generating}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              {reportsIA.generating ? <CircleNotch size={14} className="animate-spin" weight="bold" /> : <Sparkle size={14} weight="bold" />}
              {reportsIA.generating ? 'Generando...' : 'Generar ahora'}
            </button>
          </>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:gap-6">
        {/* Sidebar historial */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ClockCounterClockwise size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Historial</h3>
            <span className="ml-auto text-xs text-muted-foreground">{reportsIA.reports.length}</span>
          </div>
          {reportsIA.loading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : reportsIA.reports.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={28} weight="regular" className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sin reportes aun</p>
              {isAdmin && (
                <button onClick={handleGenerate} className="mt-3 text-xs text-primary font-semibold hover:underline">
                  Generar el primero
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[60vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto">
              {reportsIA.reports.map(r => {
                const active = reportsIA.selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => reportsIA.selectReport(r.id)}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${active ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                  >
                    <div className="text-sm font-semibold capitalize">{fmtPeriodo(r.periodo)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(r.createdAt)} · por {r.generadoPor?.nombre}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Markdown viewer */}
        <div className="bg-card border border-border rounded-lg min-w-0">
          {reportsIA.error ? (
            <div className="p-8 text-center">
              <WarningCircle size={28} className="text-red-500 mx-auto mb-2" weight="regular" />
              <p className="text-red-600 font-semibold">Error</p>
              <p className="text-xs text-muted-foreground mt-1">{reportsIA.error}</p>
            </div>
          ) : !reportsIA.selected ? (
            reportsIA.generating ? (
              <div className="p-12 text-center">
                <CircleNotch size={32} className="animate-spin text-primary mx-auto mb-3" />
                <p className="font-semibold">Claude AI esta analizando los datos</p>
                <p className="text-xs text-muted-foreground mt-1">Esto puede tardar 10-30 segundos</p>
              </div>
            ) : (
              <EmptyState icon={Sparkle}
                title="Sin reporte seleccionado"
                description={isAdmin ? 'Genera el primer reporte mensual con Claude AI o selecciona uno del historial' : 'Aun no se ha generado ningun reporte para este periodo'} />
            )
          ) : (
            <>
              {/* Header con metadata */}
              <div className="px-5 lg:px-6 py-4 border-b border-border flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold capitalize truncate">{fmtPeriodo(reportsIA.selected.periodo)}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Generado {fmtDate(reportsIA.selected.createdAt)}</span>
                    <span>· por {reportsIA.selected.generadoPor?.nombre}</span>
                    {reportsIA.selected.metadata && (
                      <>
                        <span>· {reportsIA.selected.metadata.leadsAnalizados} leads</span>
                        <span>· {reportsIA.selected.metadata.conversionesAnalizadas} conv</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleExportPdf}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {pdfLoading ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : <FilePdf size={14} weight="bold" />}
                  {pdfLoading ? 'Generando…' : 'Exportar PDF'}
                </button>
              </div>

              {/* Markdown content */}
              <div className="p-5 lg:p-8 overflow-x-auto">
                <article className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportsIA.selected.content}</ReactMarkdown>
                </article>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
