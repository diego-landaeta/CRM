import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChartLineUp,
  GearSix,
  GraduationCap,
  Kanban,
  Money,
  Users,
} from '@phosphor-icons/react';
import PreviewFilterBar, { PreviewMetricsRow } from '../components/PreviewFilterBar';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_revision', label: 'En revision' },
];

const OWNER_OPTIONS = [
  { value: '', label: 'Todos los responsables' },
  { value: 'ux', label: 'UX' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'direccion', label: 'Direccion' },
  { value: 'sistema', label: 'Sistema' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  { value: 'interno', label: 'Interno' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'web', label: 'Web' },
];

const SORT_OPTIONS = [
  { value: 'priority', label: 'Prioridad' },
  { value: 'recent', label: 'Mas reciente' },
  { value: 'module', label: 'Modulo' },
];

const PREVIEWS = [
  {
    title: 'Prospectos',
    description: 'Mesa de trabajo limpia para leads, prioridad diaria y seguimiento.',
    to: '/prueba_ui_leads',
    status: 'disponible',
    owner: 'ventas',
    channel: 'whatsapp',
    date: '2026-06-18',
    priority: 1,
    icon: Users,
  },
  {
    title: 'Clientes',
    description: 'Ficha compacta, historial comercial y documentos por cliente.',
    to: '/prueba_ui_clientes',
    status: 'disponible',
    owner: 'ventas',
    channel: 'interno',
    date: '2026-06-18',
    priority: 2,
    icon: GraduationCap,
  },
  {
    title: 'Finanzas',
    description: 'Ingresos, cobros, egresos y facturacion con lectura ejecutiva.',
    to: '/prueba_ui_finanzas',
    status: 'disponible',
    owner: 'direccion',
    channel: 'interno',
    date: '2026-06-18',
    priority: 3,
    icon: Money,
  },
  {
    title: 'Productos',
    description: 'Catalogo, precios, modulos y estado WooCommerce en una vista clara.',
    to: '/prueba_ui_productos',
    status: 'disponible',
    owner: 'sistema',
    channel: 'web',
    date: '2026-06-17',
    priority: 4,
    icon: Kanban,
  },
  {
    title: 'Reportes',
    description: 'Indicadores de direccion y comparativas por proyecto/canal.',
    to: '/prueba_ui_reportes',
    status: 'en_revision',
    owner: 'direccion',
    channel: 'interno',
    date: '2026-06-16',
    priority: 5,
    icon: ChartLineUp,
  },
  {
    title: 'Configuracion',
    description: 'Centro de control para roles, campos, integraciones y branding.',
    to: '/prueba_ui_configuracion',
    status: 'en_revision',
    owner: 'sistema',
    channel: 'interno',
    date: '2026-06-15',
    priority: 6,
    icon: GearSix,
  },
];

export default function UiPreviewHomePage() {
  const [filters, setFilters] = useState({
    search: '',
    period: 'all',
    status: '',
    owner: '',
    channel: '',
    sort: 'priority',
  });

  const filteredPreviews = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return PREVIEWS
      .filter((item) => {
        const text = `${item.title} ${item.description}`.toLowerCase();
        if (search && !text.includes(search)) return false;
        if (filters.status && item.status !== filters.status) return false;
        if (filters.owner && item.owner !== filters.owner) return false;
        if (filters.channel && item.channel !== filters.channel) return false;
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === 'recent') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (filters.sort === 'module') return a.title.localeCompare(b.title);
        return a.priority - b.priority;
      });
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      search: '',
      period: 'all',
      status: '',
      owner: '',
      channel: '',
      sort: 'priority',
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          REDISENO en testeo
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Redisenio de interfaz CRM</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Rutas paralelas para validar nuevas pantallas sin reemplazar las vistas actuales. Todas usan
          el mismo bloque de filtros para que Prospectos, Clientes, Finanzas, Productos, Reportes y
          Configuracion se sientan parte del mismo sistema.
        </p>
      </div>

      <PreviewFilterBar
        filters={filters}
        onChange={updateFilter}
        onClear={clearFilters}
        onRefresh={() => setFilters((prev) => ({ ...prev }))}
        statusOptions={STATUS_OPTIONS}
        ownerOptions={OWNER_OPTIONS}
        channelOptions={CHANNEL_OPTIONS}
        sortOptions={SORT_OPTIONS}
      />

      <PreviewMetricsRow
        summary={[
          { label: 'Paginas visibles', value: filteredPreviews.length },
          { label: 'Disponibles', value: PREVIEWS.filter((item) => item.status === 'disponible').length },
          { label: 'En revision', value: PREVIEWS.filter((item) => item.status === 'en_revision').length },
          { label: 'URL base', value: '/testeo' },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredPreviews.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className="h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <Icon size={20} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-5">{item.description}</p>
                  </div>
                </div>
                <ArrowRight size={18} weight="bold" className="mt-2 shrink-0 text-primary" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                <span className="rounded bg-muted/60 px-2 py-1">{item.status === 'disponible' ? 'Disponible' : 'En revision'}</span>
                <span className="rounded bg-muted/60 px-2 py-1">Responsable: {item.owner}</span>
                <span className="rounded bg-muted/60 px-2 py-1">Canal: {item.channel}</span>
              </div>
            </div>
          );

          return (
            <Link key={item.title} to={item.to} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
