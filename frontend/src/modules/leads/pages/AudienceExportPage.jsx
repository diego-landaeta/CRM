import { useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import { useAudienceWizard, MIN_AUDIENCE_SIZE } from '../hooks/useAudienceWizard';
import { useMetaUpload } from '../hooks/useMetaUpload';
import { useProducts } from '@/modules/products/hooks/useProducts';
import {
  Funnel, Download, Check, Users, WarningCircle, X,
  CloudArrowUp, FacebookLogo, CircleNotch, ClockCounterClockwise, FloppyDisk,
} from '@phosphor-icons/react';

const STATUS_OPTIONS = [
  { v: 'nuevo', label: 'Nuevo' },
  { v: 'por_contactar', label: 'Por contactar' },
  { v: 'contactado', label: 'Contactado' },
  { v: 'en_seguimiento', label: 'En seguimiento' },
  { v: 'convertido', label: 'Convertido' },
  { v: 'no_interesado', label: 'No interesado' },
];

const CANAL_OPTIONS = [
  { v: 'meta_ads', label: 'Meta Ads' },
  { v: 'google_ads', label: 'Google Ads' },
  { v: 'tiktok_ads', label: 'TikTok Ads' },
  { v: 'organico', label: 'Orgánico' },
  { v: 'directo', label: 'Directo' },
  { v: 'referido', label: 'Referido' },
];

const STATUS_COLORS = {
  nuevo: '#3b82f6',
  por_contactar: '#f59e0b',
  contactado: '#10b981',
  en_seguimiento: '#eab308',
  convertido: '#8b5cf6',
  no_interesado: '#ef4444',
};

const PRESETS = [
  { id: 'no-convertidos', label: 'No convertidos', desc: 'Ideal para retargeting', filter: { statuses: ['nuevo', 'por_contactar', 'contactado', 'en_seguimiento'] } },
  { id: 'convertidos', label: 'Convertidos', desc: 'Excluir o upsell', filter: { statuses: ['convertido'] } },
  { id: 'paid', label: 'Solo pagado', desc: 'Meta + Google', filter: { canales: ['meta_ads', 'google_ads', 'tiktok_ads'] } },
  { id: 'organico', label: 'Orgánico', desc: 'SEO + directo', filter: { canales: ['organico', 'directo'] } },
];

function fmtNum(n) { return new Intl.NumberFormat('es-ES').format(Number(n || 0)); }

export default function AudienceExportPage() {
  const { activeProject } = useProjectContext();
  const wizard = useAudienceWizard(activeProject?.id, activeProject?.slug);
  const meta = useMetaUpload(activeProject?.id);
  const { products } = useProducts(activeProject?.id);
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile drawer

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crear audiencia" subtitle="Selecciona un proyecto" />
        <EmptyState icon={Users} title="Sin proyecto" description="Elige un proyecto del selector lateral" />
      </div>
    );
  }

  const inFlight = meta.upload && meta.upload.status !== 'completed' && meta.upload.status !== 'error';

  async function handleDownload() {
    const r = await wizard.downloadCsv();
    if (r?.success) toast({ title: 'CSV descargado', description: `${fmtNum(wizard.totalCount)} prospectos exportados` });
    else if (r?.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
  }

  async function handleMetaUpload() {
    try {
      await meta.startUpload({ filters: wizard.filters });
      toast({ title: 'Upload iniciado', description: 'La audiencia se esta procesando en Meta' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  function applyPreset(p) {
    wizard.resetFilters();
    if (p.filter.statuses) p.filter.statuses.forEach(s => wizard.toggleStatus(s));
    if (p.filter.canales) p.filter.canales.forEach(c => wizard.toggleCanal(c));
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Crear audiencia"
        subtitle={`${activeProject.nombre} — Filtra prospectos y exporta a Meta o CSV`}
        actions={
          <button
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted"
          >
            <Funnel size={14} weight="bold" /> Filtros
            {(wizard.filters.statuses.length + wizard.filters.canales.length) > 0 && (
              <span className="text-[10px] font-semibold bg-primary text-white rounded-full px-1.5 py-0.5">
                {wizard.filters.statuses.length + wizard.filters.canales.length}
              </span>
            )}
          </button>
        }
      />

      {/* Layout 2 cols desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

        {/* SIDEBAR FILTROS — desktop fijo, mobile drawer */}
        <aside className={`
          lg:block lg:relative lg:bg-transparent lg:p-0 lg:inset-auto lg:z-auto
          ${filtersOpen ? 'fixed inset-0 !m-0 z-50 bg-black/40' : 'hidden'}
        `}>
          <div className={`
            bg-card border border-border rounded-lg lg:rounded-lg
            ${filtersOpen ? 'fixed right-0 top-0 bottom-0 w-[320px] max-w-[85vw] rounded-none border-l overflow-y-auto' : ''}
            lg:sticky lg:top-4
          `}>
            {/* Header drawer mobile */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border lg:hidden">
              <span className="font-semibold text-sm">Filtros</span>
              <button onClick={() => setFiltersOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Presets rapidos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Atajos</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className="text-left p-2 rounded-md border border-border bg-muted/30 hover:bg-muted transition-colors"
                    >
                      <div className="text-xs font-semibold">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Estado */}
              <FilterSection title="Estado" count={wizard.filters.statuses.length}>
                <CheckList options={STATUS_OPTIONS} selected={wizard.filters.statuses} onToggle={wizard.toggleStatus} />
              </FilterSection>

              {/* Canal */}
              <FilterSection title="Canal" count={wizard.filters.canales.length}>
                <CheckList options={CANAL_OPTIONS} selected={wizard.filters.canales} onToggle={wizard.toggleCanal} />
              </FilterSection>

              {/* Fechas */}
              <FilterSection title="Fechas">
                <div className="space-y-2">
                  <input type="date" value={wizard.filters.fechaDesde}
                    onChange={e => wizard.setFilter({ fechaDesde: e.target.value })}
                    className="w-full h-9 px-2 rounded-md border border-border bg-card text-xs" />
                  <input type="date" value={wizard.filters.fechaHasta}
                    onChange={e => wizard.setFilter({ fechaHasta: e.target.value })}
                    className="w-full h-9 px-2 rounded-md border border-border bg-card text-xs" />
                </div>
              </FilterSection>

              {/* Producto */}
              <FilterSection title="Producto">
                <select
                  value={wizard.filters.productoId || ''}
                  onChange={e => wizard.setFilter({ productoId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full h-9 px-2 rounded-md border border-border bg-card text-xs"
                >
                  <option value="">Cualquier producto</option>
                  {(products || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </FilterSection>

              {/* Importe */}
              <FilterSection title="Importe minimo">
                <input
                  type="number" min="0" step="50"
                  value={wizard.filters.importeMinimo || ''}
                  onChange={e => wizard.setFilter({ importeMinimo: e.target.value ? Number(e.target.value) : null })}
                  placeholder="EUR"
                  className="w-full h-9 px-2 rounded-md border border-border bg-card text-xs"
                />
              </FilterSection>

              {(wizard.filters.statuses.length + wizard.filters.canales.length > 0 ||
                wizard.filters.fechaDesde || wizard.filters.fechaHasta ||
                wizard.filters.productoId || wizard.filters.importeMinimo) && (
                <button
                  onClick={wizard.resetFilters}
                  className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 py-2 rounded-md border border-border hover:bg-muted"
                >
                  <X size={12} /> Limpiar todos
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="space-y-5 min-w-0">

          {/* Resultado + acciones */}
          <ResultsHeader
            totalCount={wizard.totalCount}
            loading={wizard.previewLoading}
            meetsMinimum={wizard.meetsMinimum}
            filename={wizard.filename}
            onDownload={handleDownload}
            onMetaUpload={handleMetaUpload}
            downloadLoading={wizard.downloadLoading}
            metaInFlight={inFlight}
          />

          {/* Estado upload Meta en curso */}
          {meta.upload && (
            <UploadStatusCard upload={meta.upload} onReset={meta.reset} />
          )}

          {/* Breakdowns + sample */}
          {wizard.preview && wizard.totalCount > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownCard title="Por estado" data={wizard.preview.breakdown.status} colors={STATUS_COLORS} />
                <BreakdownCard title="Por canal" data={wizard.preview.breakdown.canal} colors={null} />
              </div>

              <SampleTable sample={wizard.preview.sample} totalCount={wizard.totalCount} />
            </>
          ) : !wizard.previewLoading ? (
            <div className="bg-card border border-border rounded-lg">
              <EmptyState icon={Funnel} title="Sin resultados" description="No hay leads que cumplan los filtros actuales. Prueba a relajar los criterios." />
            </div>
          ) : null}

          {/* Historial uploads Meta */}
          <MetaHistorySection history={meta.history} loading={meta.historyLoading} />
        </div>
      </div>
    </div>
  );
}

// ---------- Header con resultado + CTAs ----------
function ResultsHeader({ totalCount, loading, meetsMinimum, filename, onDownload, onMetaUpload, downloadLoading, metaInFlight }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Cantidad + estado */}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Audiencia resultante</p>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="text-3xl font-semibold tabular-nums">
              {loading ? <span className="text-muted-foreground">…</span> : fmtNum(totalCount)}
            </span>
            <span className="text-sm text-muted-foreground">leads</span>
            {!loading && totalCount > 0 && (
              meetsMinimum ? (
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <Check size={11} weight="bold" /> Lista para Meta
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1">
                  <WarningCircle size={11} weight="fill" /> &lt; {MIN_AUDIENCE_SIZE} leads minimo
                </span>
              )
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-1.5">{filename}</p>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={onDownload}
            disabled={!meetsMinimum || downloadLoading || loading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap"
          >
            {downloadLoading ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : <Download size={14} weight="bold" />}
            <span>{downloadLoading ? 'Generando...' : 'Descargar CSV'}</span>
          </button>
          <button
            onClick={onMetaUpload}
            disabled={!meetsMinimum || metaInFlight || loading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {metaInFlight ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : <CloudArrowUp size={14} weight="bold" />}
            <span className="hidden sm:inline">Subir a Meta</span>
            <span className="sm:hidden">Meta</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Filter helpers ----------
function FilterSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {count > 0 && (
          <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function CheckList({ options, selected, onToggle }) {
  return (
    <div className="space-y-1.5">
      {options.map(opt => {
        const active = selected.includes(opt.v);
        return (
          <label key={opt.v} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground transition-colors">
            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              active ? 'bg-primary border-primary text-white' : 'border-border bg-card'
            }`}>
              {active && <Check size={10} weight="bold" />}
            </span>
            <input type="checkbox" checked={active} onChange={() => onToggle(opt.v)} className="sr-only" />
            <span className={active ? 'text-foreground font-medium' : 'text-muted-foreground'}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ---------- Breakdowns ----------
function BreakdownCard({ title, data, colors }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-semibold mb-3 text-sm">{title}</h3>
      <div className="space-y-2.5">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos</p>
        ) : entries.map(([k, v]) => {
          const pct = (v / total) * 100;
          const color = colors?.[k] || '#9ca3af';
          return (
            <div key={k} className="flex items-center gap-3">
              <span className="text-xs w-28 truncate text-muted-foreground">{k.replace(/_/g, ' ')}</span>
              <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
                <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="text-xs tabular-nums font-semibold w-10 text-right">{fmtNum(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Sample table ----------
function SampleTable({ sample, totalCount }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Muestra ({sample.length} de {fmtNum(totalCount)})</h3>
        <span className="text-[11px] text-muted-foreground">Email/telefono se hashean SHA-256 al exportar</span>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-bold">Nombre</th>
              <th className="text-left px-4 py-2 font-bold">Email</th>
              <th className="text-left px-4 py-2 font-bold">Telefono</th>
              <th className="text-left px-4 py-2 font-bold">Estado</th>
              <th className="text-left px-4 py-2 font-bold">Canal</th>
            </tr>
          </thead>
          <tbody>
            {sample.map(l => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{l.nombre}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{l.telefono}</td>
                <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted">{l.estado}</span></td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.canal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-border">
        {sample.map(l => (
          <div key={l.id} className="p-4 space-y-1">
            <div className="font-semibold">{l.nombre}</div>
            <div className="text-xs text-muted-foreground">{l.email}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted">{l.estado}</span>
              <span className="text-muted-foreground">{l.canal}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- CRM-115: timeline upload Meta ----------
const UPLOAD_STAGES = [
  { id: 'preparing', label: 'Preparando' },
  { id: 'uploading', label: 'Subiendo a Meta' },
  { id: 'processing', label: 'Procesando en Meta' },
  { id: 'completed', label: 'Completado' },
];

function UploadStatusCard({ upload, onReset }) {
  const currentIdx = UPLOAD_STAGES.findIndex(s => s.id === upload.status);
  const isDone = upload.status === 'completed';

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
          <FacebookLogo size={18} weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{upload.audienceName}</p>
          <p className="text-xs text-muted-foreground">
            ID Meta: <span className="font-mono">{upload.audienceId}</span> · {fmtNum(upload.recordsUploaded)} registros
          </p>
        </div>
        {isDone && (
          <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 flex-shrink-0">
            <X size={12} /> Cerrar
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {UPLOAD_STAGES.map((stage, i) => {
          const completed = i < currentIdx || (i === currentIdx && stage.id === 'completed');
          const active = i === currentIdx && !completed;
          return (
            <div key={stage.id} className="flex items-center flex-1 sm:flex-initial">
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium ${
                completed ? 'text-emerald-700 dark:text-emerald-400' :
                active ? 'text-blue-700 dark:text-blue-400' :
                'text-muted-foreground'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40' :
                  active ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40' :
                  'bg-muted'
                }`}>
                  {completed ? <Check size={10} weight="bold" /> :
                   active ? <CircleNotch size={10} weight="bold" className="animate-spin" /> :
                   i + 1}
                </div>
                <span className="hidden sm:inline">{stage.label}</span>
              </div>
              {i < UPLOAD_STAGES.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${completed ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {isDone && upload.matchRate && (
        <div className="mt-3 flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-md px-3 py-2">
          <Check size={14} weight="bold" className="text-emerald-700 dark:text-emerald-400" />
          <span>Match rate: <span className="font-semibold tabular-nums">{upload.matchRate}%</span></span>
        </div>
      )}
    </div>
  );
}

// ---------- CRM-115: historial uploads ----------
function MetaHistorySection({ history, loading }) {
  if (loading || !history || history.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ClockCounterClockwise size={16} className="text-muted-foreground" />
        <h3 className="font-semibold text-sm">Historial uploads Meta</h3>
        <span className="text-xs text-muted-foreground">({history.length})</span>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-bold">Audiencia</th>
              <th className="text-left px-4 py-2 font-bold">Fecha</th>
              <th className="text-right px-4 py-2 font-bold">Prospectos</th>
              <th className="text-right px-4 py-2 font-bold">Match rate</th>
              <th className="text-left px-4 py-2 font-bold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.audienceId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-semibold truncate max-w-[280px]">{h.audienceName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{h.audienceId}</div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {new Date(h.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(h.recordsUploaded)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {h.matchRate != null ? <span className="font-semibold">{h.matchRate}%</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    h.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                    h.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{h.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-border">
        {history.map(h => (
          <div key={h.audienceId} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{h.audienceName}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{h.audienceId}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                h.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>{h.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{new Date(h.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              <span className="tabular-nums">{fmtNum(h.recordsUploaded)} leads</span>
              {h.matchRate != null && <span className="tabular-nums font-semibold">{h.matchRate}% match</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
