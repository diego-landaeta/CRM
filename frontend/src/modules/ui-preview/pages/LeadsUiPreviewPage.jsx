import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  DotsThreeVertical,
  Plus,
  Pulse,
  Sparkle,
  UserCircle,
} from '@phosphor-icons/react';
import { useLeads } from '@/modules/leads/hooks/useLeads';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import StatusBadge, { STATUS_LABELS } from '@/shared/components/ui/StatusBadge';
import ChannelBadge from '@/shared/components/ui/ChannelBadge';
import PreviewFilterBar, { PreviewMetricsRow } from '../components/PreviewFilterBar';
import { cn } from '@/shared/lib/utils';

const STATUS_FILTERS = [
  { key: '', label: 'Todos los estados' },
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'por_contactar', label: 'Por contactar' },
  { key: 'contactado', label: 'Contactado' },
  { key: 'en_seguimiento', label: 'En seguimiento' },
  { key: 'convertido', label: 'Convertido' },
  { key: 'no_interesado', label: 'No interesado' },
  { key: 'proxima_convocatoria', label: 'Proxima convocatoria' },
];

const SORT_OPTIONS = [
  { value: 'recent_value', label: 'Reciente + valor' },
  { value: 'urgency', label: 'Urgencia' },
  { value: 'recent', label: 'Mas recientes' },
  { value: 'value', label: 'Mayor valor' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'tiktok_ads', label: 'TikTok Ads' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'organico', label: 'Organico' },
  { value: 'chatgpt_ia', label: 'ChatGPT IA' },
  { value: 'referido', label: 'Referido' },
  { value: 'directo', label: 'Directo' },
];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value, currency = 'EUR') {
  const n = toNumber(value);
  if (!n) return 'Sin importe';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString('es-ES')} ${currency || 'EUR'}`;
  }
}

function dateLabel(value) {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysFromToday(value) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
}

function reminderLabel(value) {
  const delta = daysFromToday(value);
  if (delta === null) return { label: 'Sin recordatorio', tone: 'muted' };
  if (delta < 0) return { label: `Vencido ${Math.abs(delta)}d`, tone: 'danger' };
  if (delta === 0) return { label: 'Hoy', tone: 'warning' };
  if (delta === 1) return { label: 'Manana', tone: 'info' };
  return { label: `En ${delta}d`, tone: 'muted' };
}

function getLeadValue(lead) {
  return toNumber(lead.producto_precio || lead.importe_total || lead.valor_estimado);
}

function getLeadOwner(lead) {
  return lead.responsable_nombre || lead.gestor || 'Sin asignar';
}

function getPriority(lead) {
  const status = lead.estado || lead.status;
  const reminder = daysFromToday(lead.next_reminder_at);
  if (reminder !== null && reminder <= 0) return 'alta';
  if (!lead.last_interaction_at && ['nuevo', 'por_contactar'].includes(status)) return 'alta';
  if (getLeadValue(lead) >= 1000) return 'media';
  if (lead.reincidente || lead.es_propuesto) return 'media';
  return 'normal';
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
}

function SkeletonRows() {
  return Array.from({ length: 8 }).map((_, i) => (
    <tr key={i} className="border-b border-border">
      <td className="px-4 py-3"><div className="h-9 w-44 rounded bg-muted animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-28 rounded bg-muted animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-32 rounded bg-muted animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-24 rounded bg-muted animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 rounded bg-muted animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 rounded bg-muted animate-pulse" /></td>
    </tr>
  ));
}

function PriorityPill({ value }) {
  const label = { alta: 'Alta', media: 'Media', normal: 'Normal' }[value] || 'Normal';
  const cls = {
    alta: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    media: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    normal: 'bg-muted text-muted-foreground',
  }[value];
  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', cls)}>{label}</span>;
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} weight="bold" className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  );
}

export default function LeadsUiPreviewPage() {
  const navigate = useNavigate();
  const { activeProject, projects, isAllProjects } = useProjectContext();
  const {
    leads,
    stats,
    total,
    page,
    totalPages,
    setPage,
    search,
    setSearch,
    filterEstado,
    setFilterEstado,
    filterOrigen,
    setFilterOrigen,
    filterResponsable,
    setFilterResponsable,
    filterProducto,
    setFilterProducto,
    dateFrom,
    dateTo,
    setDateRange,
    sortMode,
    setSortMode,
    filterDup,
    setFilterDup,
    filterReincidente,
    setFilterReincidente,
    loading,
    error,
    refetch,
  } = useLeads();
  const [selectedId, setSelectedId] = useState(null);
  const { products } = useProducts(!isAllProjects ? activeProject?.id : null);

  const ownerOptions = useMemo(
    () => {
      const seen = new Set();
      const options = [{ value: '', label: 'Todos los responsables' }];
      leads.forEach((lead) => {
        if (!lead.responsable_id) {
          if (!seen.has('unassigned')) {
            seen.add('unassigned');
            options.push({ value: 'unassigned', label: 'Sin asignar' });
          }
          return;
        }
        const value = String(lead.responsable_id);
        if (seen.has(value)) return;
        seen.add(value);
        options.push({ value, label: getLeadOwner(lead) });
      });
      return options;
    },
    [leads],
  );
  const productOptions = useMemo(() => {
    const options = [{ value: '', label: 'Todos los programas' }];
    const seen = new Set();
    products.forEach((product) => {
      if (!product?.id || seen.has(String(product.id))) return;
      seen.add(String(product.id));
      options.push({ value: String(product.id), label: product.nombre });
    });
    leads.forEach((lead) => {
      const id = lead.producto_id || lead.producto_interes_id;
      const label = lead.producto_nombre || lead.producto_interes;
      if (!id || !label || seen.has(String(id))) return;
      seen.add(String(id));
      options.push({ value: String(id), label });
    });
    return options;
  }, [leads, products]);
  const statusOptions = useMemo(
    () => STATUS_FILTERS.map((filter) => ({
      value: filter.key,
      label: filter.label,
      count: filter.key ? stats?.[filter.key] : stats?.total,
    })),
    [stats],
  );

  const visibleLeads = leads;

  useEffect(() => {
    if (!visibleLeads.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleLeads.some((lead) => lead.id === selectedId)) {
      setSelectedId(visibleLeads[0].id);
    }
  }, [visibleLeads, selectedId]);

  const selectedLead = visibleLeads.find((lead) => lead.id === selectedId) || visibleLeads[0] || null;

  const board = useMemo(() => {
    const highPriority = visibleLeads.filter((lead) => getPriority(lead) === 'alta').length;
    const overdue = visibleLeads.filter((lead) => {
      const d = daysFromToday(lead.next_reminder_at);
      return d !== null && d < 0;
    }).length;
    const today = visibleLeads.filter((lead) => daysFromToday(lead.next_reminder_at) === 0).length;
    const noContact = visibleLeads.filter((lead) => !lead.last_interaction_at && ['nuevo', 'por_contactar'].includes(lead.estado || lead.status)).length;
    const value = visibleLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0);
    return { highPriority, overdue, today, noContact, value };
  }, [visibleLeads]);

  const filterSummary = [
    { label: 'Total en testeo', value: total || stats?.total || visibleLeads.length },
    { label: 'Visibles en pagina', value: visibleLeads.length },
    { label: 'Prioridad alta', value: board.highPriority },
    { label: 'Valor visible', value: money(board.value) },
  ];

  function updateFilter(key, value) {
    if (key === 'search') {
      setSearch(value);
      setPage(1);
      return;
    }
    if (key === 'status') {
      setFilterEstado(value);
      setPage(1);
      return;
    }
    if (key === 'channel') {
      setFilterOrigen(value);
      setPage(1);
      return;
    }
    if (key === 'owner') {
      setFilterResponsable(value);
      setPage(1);
      return;
    }
    if (key === 'product') {
      setFilterProducto(value);
      setPage(1);
      return;
    }
    if (key === 'dateFrom') {
      setDateRange(value, dateTo || '');
      return;
    }
    if (key === 'dateTo') {
      setDateRange(dateFrom || '', value);
      return;
    }
    if (key === 'sort') {
      setSortMode(value);
      return;
    }
    if (key === 'duplicated') {
      setFilterDup(Boolean(value));
      return;
    }
    if (key === 'reincidente') {
      setFilterReincidente(Boolean(value));
    }
  }

  function clearFilters() {
    setSearch('');
    setFilterEstado('');
    setFilterOrigen('');
    setFilterResponsable('');
    setFilterProducto('');
    setDateRange('', '');
    setSortMode('recent_value');
    setFilterDup(false);
    setFilterReincidente(false);
    setPage(1);
  }

  const projectLabel = isAllProjects
    ? `Todos los proyectos (${projects?.length || 0})`
    : activeProject?.nombre || 'Sin proyecto';

  return (
    <div className="space-y-5 max-w-[1480px] mx-auto">
      <PageHeader
        title="Prueba UI - Prospectos"
        subtitle={`Vista paralela de testeo. Proyecto: ${projectLabel}`}
        actions={(
          <>
            <button
              type="button"
              onClick={() => navigate('/prospectos')}
              className="h-9 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Vista actual
            </button>
            <button
              type="button"
              onClick={() => navigate('/prospectos?new=1')}
              className="h-9 inline-flex items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} weight="bold" />
              Nuevo prospecto
            </button>
          </>
        )}
      />

      <PreviewFilterBar
        filters={{
          search,
          status: filterEstado,
          owner: filterResponsable,
          channel: filterOrigen,
          product: filterProducto,
          dateFrom,
          dateTo,
          sort: sortMode,
          duplicated: filterDup,
          reincidente: filterReincidente,
        }}
        onChange={updateFilter}
        onClear={clearFilters}
        onRefresh={refetch}
        statusOptions={statusOptions}
        ownerOptions={ownerOptions}
        channelOptions={CHANNEL_OPTIONS}
        productOptions={productOptions}
        sortOptions={SORT_OPTIONS}
        defaultSort="recent_value"
        showPeriod={false}
        showDateRange
        showProduct
        showAdvanced
      />

      <PreviewMetricsRow summary={filterSummary} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-semibold">Mesa de prospectos</h2>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Cargando datos...' : `${visibleLeads.length} visibles en esta pagina`}
              </p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <Sparkle size={14} weight="bold" />
              Ruta de prueba, no reemplaza la vista actual
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Prospecto</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Programa</th>
                  <th className="px-4 py-3 text-left font-semibold">Gestion</th>
                  <th className="px-4 py-3 text-left font-semibold">Canal</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : visibleLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No hay prospectos con estos filtros.
                    </td>
                  </tr>
                ) : (
                  visibleLeads.map((lead) => {
                    const priority = getPriority(lead);
                    const reminder = reminderLabel(lead.next_reminder_at);
                    const selected = selectedLead?.id === lead.id;
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedId(lead.id)}
                        className={cn(
                          'cursor-pointer border-b border-border transition-colors hover:bg-muted/45',
                          selected && 'bg-primary/5',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-foreground">
                              {initials(lead.nombre)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate font-semibold">{lead.nombre || 'Sin nombre'}</span>
                                <PriorityPill value={priority} />
                              </div>
                              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">{lead.email || 'Sin email'}</span>
                                {lead.telefono && <span className="truncate">- {lead.telefono}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lead.estado || lead.status} showIcon />
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[220px] truncate font-medium">
                            {lead.producto_nombre || lead.producto_interes || 'Sin programa'}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {dateLabel(lead.created_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="truncate font-medium">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</span>
                            <span className={cn(
                              'inline-flex w-fit rounded px-2 py-0.5 text-xs font-semibold',
                              reminder.tone === 'danger' && 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
                              reminder.tone === 'warning' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
                              reminder.tone === 'info' && 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
                              reminder.tone === 'muted' && 'bg-muted text-muted-foreground',
                            )}>
                              {reminder.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ChannelBadge channel={lead.origen || lead.canal_detectado || lead.canal} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold tabular-nums">
                            {money(getLeadValue(lead), lead.producto_moneda || 'EUR')}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/prospectos/${lead.id}`);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Abrir <ArrowRight size={11} weight="bold" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages || 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold disabled:opacity-45"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold disabled:opacity-45"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Prioridad del dia</h2>
                <p className="text-xs text-muted-foreground">Lectura rapida para gestor o admin.</p>
              </div>
              <Pulse size={20} weight="bold" className="text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label="Sin contacto" value={board.noContact} />
              <MiniStat label="Vencidos" value={board.overdue} />
              <MiniStat label="Hoy" value={board.today} />
              <MiniStat label="Alta prioridad" value={board.highPriority} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Ficha rapida</h2>
              <DotsThreeVertical size={18} weight="bold" className="text-muted-foreground" />
            </div>
            {selectedLead ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
                    {initials(selectedLead.nombre)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{selectedLead.nombre}</h3>
                    <p className="truncate text-sm text-muted-foreground">{selectedLead.email || selectedLead.telefono || 'Sin contacto'}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <InfoRow icon={UserCircle} label="Gestor" value={selectedLead.responsable_nombre || selectedLead.gestor || 'Sin asignar'} />
                  <InfoRow icon={CalendarBlank} label="Recordatorio" value={reminderLabel(selectedLead.next_reminder_at).label} />
                  <InfoRow icon={Sparkle} label="Programa" value={selectedLead.producto_nombre || selectedLead.producto_interes || 'Sin programa'} />
                  <InfoRow icon={CheckCircle} label="Estado" value={STATUS_LABELS[selectedLead.estado || selectedLead.status] || selectedLead.estado || 'Sin estado'} />
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/prospectos/${selectedLead.id}`)}
                  className="h-9 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Abrir ficha actual
                  <ArrowRight size={14} weight="bold" />
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Selecciona un prospecto de la tabla.</p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">Decisiones UX aplicadas</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Filtros principales en una sola franja.</li>
              <li>Tabla densa, con prioridad y siguiente accion visibles.</li>
              <li>Panel lateral de lectura sin abrir modales.</li>
              <li>Acciones actuales conservadas por enlace, sin sustituir flujo.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
