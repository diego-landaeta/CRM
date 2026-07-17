// Descargable combinado "Prospectos + Ventas" (Análisis › Reportes).
// Trae TODOS los prospectos del alcance/período INCLUYENDO los convertidos
// (ventas), que en el listado operativo de Prospectos quedan ocultos. Pensado
// para análisis del owner en un solo archivo, sin sobrecargar el módulo de
// Prospectos. Reutiliza las columnas del export universal (getLeadExportColumns).
import client from '@/shared/api/client';
import type { Lead } from '@/shared/types';
import { runExport, type ExportFormat } from '@/shared/lib/export';
import { getLeadExportColumns } from '@/modules/leads/lib/leadFormat';

export interface ReportLeadFilters {
  projectId?: number;
  projectIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  /** Incluir los leads ya convertidos (ventas). Por defecto true en este reporte. */
  includeConverted?: boolean;
}

// El backend mapea el estado como `status`; el export usa `estado`. Igual que
// normalizeLead() en useLeads, pero sin arrastrar el hook a esta ruta.
function normalize(row: Record<string, unknown>): Lead {
  return {
    ...row,
    estado: (row.status as string) || (row.estado as string),
    origen: (row.canal_detectado as string) || (row.origen as string) || 'directo',
  } as unknown as Lead;
}

/** Pagina /leads (limit 500) hasta traer TODO lo filtrado. */
export async function fetchLeadsForReport(f: ReportLeadFilters): Promise<Lead[]> {
  const PAGE = 500;
  const all: Lead[] = [];
  let page = 1;
  for (let guard = 0; guard < 100; guard++) {
    const p = new URLSearchParams();
    if (f.projectIds && f.projectIds.length) p.set('projectIds', f.projectIds.join(','));
    else if (f.projectId) p.set('projectId', String(f.projectId));
    if (f.dateFrom) p.set('dateFrom', f.dateFrom);
    if (f.dateTo) p.set('dateTo', f.dateTo);
    if (f.includeConverted) p.set('includeConverted', 'true');
    p.set('page', String(page));
    p.set('limit', String(PAGE));
    const res = await client.get(`/leads?${p.toString()}`);
    if (!res.success) break;
    const batch = ((res.data as Record<string, unknown>[]) || []).map(normalize);
    all.push(...batch);
    const total = (res as { pagination?: { total?: number } }).pagination?.total ?? all.length;
    if (batch.length < PAGE || all.length >= total) break;
    page += 1;
  }
  return all;
}

/** Trae las filas y dispara la descarga (CSV/XLSX) con las columnas del export universal. */
export async function downloadLeadsReport(
  f: ReportLeadFilters,
  opts: { format?: ExportFormat; filename?: string } = {},
): Promise<number> {
  const rows = await fetchLeadsForReport({ includeConverted: true, ...f });
  const columns = getLeadExportColumns();
  await runExport({
    context: 'leads-report',
    filename: opts.filename || `prospectos-ventas-${new Date().toISOString().slice(0, 10)}`,
    format: opts.format || 'xlsx',
    columns,
    config: columns.map((c) => ({ key: c.key, label: c.label, included: true })),
    rows,
  });
  return rows.length;
}
