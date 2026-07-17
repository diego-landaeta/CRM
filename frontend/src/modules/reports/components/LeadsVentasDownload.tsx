// Tarjeta "Prospectos + Ventas (descargable)" en Análisis › Reportes.
// Combina en un solo archivo todos los prospectos del período INCLUYENDO los
// que ya son venta (convertidos). Es el destino del atajo que hay en Prospectos.
import { useState } from 'react';
import { DownloadSimple, FileXls, FileCsv, UsersThree } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { downloadLeadsReport } from '../lib/leadsReport';
import type { ExportFormat } from '@/shared/lib/export';

interface Props {
  projectId?: number;
  projectName?: string;
  range: { from: string; to: string };
}

export default function LeadsVentasDownload({ projectId, projectName, range }: Props) {
  const [includeConverted, setIncludeConverted] = useState(true);
  const [byPeriod, setByPeriod] = useState(true);
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function handle(format: ExportFormat) {
    setBusy(format);
    try {
      const n = await downloadLeadsReport(
        {
          projectId,
          dateFrom: byPeriod ? range.from : undefined,
          dateTo: byPeriod ? range.to : undefined,
          includeConverted,
        },
        {
          format,
          filename: `prospectos-ventas-${projectName || 'crm'}-${byPeriod ? `${range.from}_${range.to}` : 'todo'}`,
        },
      );
      toast({ title: 'Descarga lista', description: `${n} registro${n === 1 ? '' : 's'} exportado${n === 1 ? '' : 's'}.` });
    } catch (err) {
      toast({ title: 'No se pudo generar el archivo', description: (err as { message?: string })?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <UsersThree size={18} weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Prospectos + Ventas (descargable)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Un solo archivo con todos los prospectos {byPeriod ? 'del período' : '(histórico completo)'}
            {includeConverted ? ', incluyendo los que ya son venta' : ''}. Para análisis, sin sobrecargar Prospectos.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <input type="checkbox" checked={includeConverted} onChange={(e) => setIncludeConverted(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40" />
              Incluir ventas (convertidos)
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <input type="checkbox" checked={byPeriod} onChange={(e) => setByPeriod(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40" />
              Limitar al período seleccionado
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" disabled={busy !== null} onClick={() => handle('xlsx')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40">
              <FileXls size={14} weight="bold" /> {busy === 'xlsx' ? 'Generando…' : 'Descargar Excel'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => handle('csv')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40">
              <FileCsv size={14} weight="bold" /> {busy === 'csv' ? 'Generando…' : 'CSV'}
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <DownloadSimple size={12} /> {projectName || 'Todos los proyectos'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
