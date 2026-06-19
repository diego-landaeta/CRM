import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  GearSix,
  GraduationCap,
  Money,
  Package,
  Pulse,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import PreviewFilterBar, { PreviewMetricsRow } from '../components/PreviewFilterBar';
import { cn } from '@/shared/lib/utils';

const SORT_OPTIONS = [
  { value: 'priority', label: 'Prioridad' },
  { value: 'recent', label: 'Mas reciente' },
  { value: 'value', label: 'Mayor impacto' },
  { value: 'status', label: 'Estado' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activo' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'riesgo', label: 'Riesgo' },
  { value: 'completado', label: 'Completado' },
];

const OWNER_OPTIONS = [
  { value: '', label: 'Todos los responsables' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'operaciones', label: 'Operaciones' },
  { value: 'direccion', label: 'Direccion' },
  { value: 'sistema', label: 'Sistema' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web' },
  { value: 'interno', label: 'Interno' },
];

const AREA_CONFIG = {
  clientes: {
    title: 'Redisenio - Clientes',
    subtitle: 'Ficha comercial clara, actividad reciente y riesgo de retencion.',
    currentPath: '/clientes',
    icon: GraduationCap,
    primaryMetric: 'Clientes activos',
    rows: [
      { title: 'Maria Lopez', subtitle: 'Master en Psicologia Educativa', status: 'activo', owner: 'ventas', channel: 'whatsapp', priority: 'alta', date: '2026-06-17', value: 2400, note: 'Pago parcial pendiente' },
      { title: 'Grupo ISEIE - Cohorte junio', subtitle: '28 matriculas vinculadas', status: 'pendiente', owner: 'operaciones', channel: 'email', priority: 'media', date: '2026-06-15', value: 12800, note: 'Validar documentos' },
      { title: 'Luis Fernandez', subtitle: 'Especializacion en Direccion', status: 'riesgo', owner: 'ventas', channel: 'whatsapp', priority: 'alta', date: '2026-06-10', value: 1800, note: 'Sin contacto hace 8 dias' },
      { title: 'Carolina Rivas', subtitle: 'Diplomado en Neuroeducacion', status: 'completado', owner: 'operaciones', channel: 'web', priority: 'normal', date: '2026-05-28', value: 900, note: 'Alta completada' },
    ],
    improvements: [
      'Ficha lateral con pagos, documentos y ultimas interacciones.',
      'Riesgo visible sin entrar al detalle del cliente.',
      'Accion siguiente siempre en la primera pantalla.',
    ],
  },
  finanzas: {
    title: 'Redisenio - Finanzas',
    subtitle: 'Lectura ejecutiva de ingresos, cobros, egresos y pendientes.',
    currentPath: '/finanzas',
    icon: Money,
    primaryMetric: 'Importe visible',
    rows: [
      { title: 'Ingresos confirmados', subtitle: 'Ventas registradas y conciliadas', status: 'activo', owner: 'direccion', channel: 'interno', priority: 'media', date: '2026-06-18', value: 46800, note: 'Sube 12% vs periodo anterior' },
      { title: 'Pendientes de cobro', subtitle: 'Facturas y cuotas por vencer', status: 'pendiente', owner: 'operaciones', channel: 'email', priority: 'alta', date: '2026-06-16', value: 19300, note: 'Separar vencidos de por vencer' },
      { title: 'Egresos operativos', subtitle: 'Servicios, proveedores y comisiones', status: 'riesgo', owner: 'direccion', channel: 'interno', priority: 'media', date: '2026-06-12', value: 8200, note: 'Tres partidas sin categoria' },
      { title: 'Stripe y pasarelas', subtitle: 'Pagos online con conciliacion pendiente', status: 'completado', owner: 'sistema', channel: 'web', priority: 'normal', date: '2026-06-07', value: 15200, note: 'Ultimo lote conciliado' },
    ],
    improvements: [
      'Panel de caja diaria antes de tablas largas.',
      'Filtros identicos a otras areas para comparar por canal y responsable.',
      'Separacion visual entre dinero confirmado, pendiente y en riesgo.',
    ],
  },
  productos: {
    title: 'Redisenio - Productos',
    subtitle: 'Catalogo con precios, estado comercial y dependencias visibles.',
    currentPath: '/productos',
    icon: Package,
    primaryMetric: 'Programas visibles',
    rows: [
      { title: 'Master Psicologia Educativa', subtitle: 'Producto activo con 4 variantes', status: 'activo', owner: 'ventas', channel: 'web', priority: 'alta', date: '2026-06-18', value: 2400, note: 'Mayor conversion del mes' },
      { title: 'Curso pendiente WooCommerce', subtitle: 'Falta sincronizar imagen y precio', status: 'pendiente', owner: 'sistema', channel: 'web', priority: 'media', date: '2026-06-14', value: 650, note: 'Revisar categoria' },
      { title: 'Diplomado antiguo', subtitle: 'Baja demanda y leads sin avance', status: 'riesgo', owner: 'direccion', channel: 'interno', priority: 'media', date: '2026-06-01', value: 700, note: 'Proponer cierre o relanzamiento' },
      { title: 'Especializacion actualizada', subtitle: 'Contenido y pricing revisados', status: 'completado', owner: 'operaciones', channel: 'email', priority: 'normal', date: '2026-05-30', value: 1800, note: 'Lista para campana' },
    ],
    improvements: [
      'Catalogo escaneable con estado comercial y precio juntos.',
      'Indicador de sincronizacion para WooCommerce.',
      'Relacion rapida entre producto, leads e ingresos.',
    ],
  },
  reportes: {
    title: 'Redisenio - Reportes',
    subtitle: 'Indicadores comparables por proyecto, canal y responsable.',
    currentPath: '/reports',
    icon: ChartLineUp,
    primaryMetric: 'KPIs visibles',
    rows: [
      { title: 'Conversion por canal', subtitle: 'WhatsApp, web, email y organico', status: 'activo', owner: 'direccion', channel: 'interno', priority: 'alta', date: '2026-06-18', value: 31, note: 'WhatsApp lidera el cierre' },
      { title: 'Seguimiento gestor', subtitle: 'Actividad, respuesta y cierres', status: 'pendiente', owner: 'ventas', channel: 'interno', priority: 'alta', date: '2026-06-17', value: 74, note: 'Dos gestores con atrasos' },
      { title: 'Embudo por producto', subtitle: 'Leads, propuestas y matriculas', status: 'riesgo', owner: 'direccion', channel: 'web', priority: 'media', date: '2026-06-11', value: 18, note: 'Caida en etapa de propuesta' },
      { title: 'Reporte mensual', subtitle: 'Resumen para direccion', status: 'completado', owner: 'sistema', channel: 'email', priority: 'normal', date: '2026-06-01', value: 100, note: 'Listo para exportar' },
    ],
    improvements: [
      'Filtros compartidos para no reaprender cada reporte.',
      'KPIs con explicacion corta y accion sugerida.',
      'Comparativas enfocadas en decisiones, no solo graficas.',
    ],
  },
  configuracion: {
    title: 'Redisenio - Configuracion',
    subtitle: 'Ajustes del CRM ordenados por impacto y frecuencia de uso.',
    currentPath: '/settings',
    icon: GearSix,
    primaryMetric: 'Ajustes clave',
    rows: [
      { title: 'Usuarios y roles', subtitle: 'Permisos, equipos y accesos', status: 'activo', owner: 'sistema', channel: 'interno', priority: 'alta', date: '2026-06-18', value: 12, note: 'Separar rol comercial y soporte' },
      { title: 'Campos personalizados', subtitle: 'Definiciones por proyecto', status: 'pendiente', owner: 'operaciones', channel: 'interno', priority: 'media', date: '2026-06-16', value: 38, note: 'Limpiar campos duplicados' },
      { title: 'Canales y webhooks', subtitle: 'Make, formularios y fuentes externas', status: 'riesgo', owner: 'sistema', channel: 'web', priority: 'alta', date: '2026-06-13', value: 9, note: 'Validar endpoints activos' },
      { title: 'Branding del proyecto', subtitle: 'Logos, labels y navegacion', status: 'completado', owner: 'direccion', channel: 'interno', priority: 'normal', date: '2026-06-02', value: 5, note: 'Ajustes listos para QA' },
    ],
    improvements: [
      'Agrupar ajustes por frecuencia y riesgo.',
      'Mostrar dependencias antes de guardar cambios sensibles.',
      'Hacer visible que cambios de sidebar afectan a todo el equipo.',
    ],
  },
};

function money(value) {
  if (typeof value !== 'number') return value || '-';
  if (value > 1000) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toLocaleString('es-ES');
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function withinPeriod(rowDate, period) {
  if (!period || period === 'all') return true;
  const days = Number(period.replace('d', ''));
  if (!Number.isFinite(days)) return true;
  const date = new Date(rowDate);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return date >= start;
}

function priorityScore(priority) {
  return { alta: 3, media: 2, normal: 1 }[priority] || 0;
}

function statusLabel(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
}

function priorityLabel(value) {
  return { alta: 'Alta', media: 'Media', normal: 'Normal' }[value] || 'Normal';
}

function StatusPill({ status }) {
  const cls = {
    activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    pendiente: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    riesgo: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    completado: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  }[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', cls)}>
      {statusLabel(status)}
    </span>
  );
}

function PriorityPill({ priority }) {
  const cls = {
    alta: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    media: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    normal: 'bg-muted text-muted-foreground',
  }[priority] || 'bg-muted text-muted-foreground';
  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', cls)}>{priorityLabel(priority)}</span>;
}

function metricValue(config, rows) {
  if (config.primaryMetric === 'Importe visible') {
    return money(rows.reduce((sum, row) => sum + row.value, 0));
  }
  return rows.length;
}

export default function GenericUiPreviewPage({ area }) {
  const navigate = useNavigate();
  const config = AREA_CONFIG[area] || AREA_CONFIG.clientes;
  const Icon = config.icon;
  const [filters, setFilters] = useState({
    search: '',
    period: 'all',
    status: '',
    owner: '',
    channel: '',
    sort: 'priority',
  });

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const rows = config.rows.filter((row) => {
      const text = `${row.title} ${row.subtitle} ${row.note}`.toLowerCase();
      if (search && !text.includes(search)) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.owner && row.owner !== filters.owner) return false;
      if (filters.channel && row.channel !== filters.channel) return false;
      if (!withinPeriod(row.date, filters.period)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (filters.sort === 'recent') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (filters.sort === 'value') return b.value - a.value;
      if (filters.sort === 'status') return a.status.localeCompare(b.status);
      return priorityScore(b.priority) - priorityScore(a.priority);
    });
  }, [config.rows, filters]);

  const summary = [
    { label: 'Visibles', value: filteredRows.length },
    { label: config.primaryMetric, value: metricValue(config, filteredRows) },
    { label: 'Alta prioridad', value: filteredRows.filter((row) => row.priority === 'alta').length },
    { label: 'En riesgo', value: filteredRows.filter((row) => row.status === 'riesgo').length },
  ];

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
    <div className="space-y-5 max-w-[1480px] mx-auto">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={(
          <>
            <button
              type="button"
              onClick={() => navigate('/prueba_ui')}
              className="h-9 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Laboratorio
            </button>
            <button
              type="button"
              onClick={() => navigate(config.currentPath)}
              className="h-9 inline-flex items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Vista actual
              <ArrowRight size={14} weight="bold" />
            </button>
          </>
        )}
      />

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

      <PreviewMetricsRow summary={summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon size={20} weight="bold" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">Mesa de trabajo</h2>
                <p className="truncate text-xs text-muted-foreground">
                  Misma estructura de filtros, tabla y lectura rapida.
                </p>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground md:inline-flex">
              <Sparkle size={13} weight="bold" />
              Testeo UI
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Registro</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Responsable</th>
                  <th className="px-4 py-3 text-left font-semibold">Canal</th>
                  <th className="px-4 py-3 text-left font-semibold">Prioridad</th>
                  <th className="px-4 py-3 text-right font-semibold">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No hay resultados con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={`${row.title}-${row.date}`} className="border-b border-border hover:bg-muted/45">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{row.title}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{row.subtitle}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{row.note}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                      <td className="px-4 py-3 font-medium capitalize">{row.owner}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{row.channel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <PriorityPill priority={row.priority} />
                          <span className="text-xs text-muted-foreground">{dateLabel(row.date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(row.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Lectura rapida</h2>
                <p className="text-xs text-muted-foreground">Lo que el usuario debe entender primero.</p>
              </div>
              <Pulse size={20} weight="bold" className="text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">Activos</div>
                <div className="mt-1 text-xl font-semibold">{filteredRows.filter((row) => row.status === 'activo').length}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">Pendientes</div>
                <div className="mt-1 text-xl font-semibold">{filteredRows.filter((row) => row.status === 'pendiente').length}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">Riesgo</div>
                <div className="mt-1 text-xl font-semibold">{filteredRows.filter((row) => row.status === 'riesgo').length}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">Completado</div>
                <div className="mt-1 text-xl font-semibold">{filteredRows.filter((row) => row.status === 'completado').length}</div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} weight="bold" className="text-emerald-600" />
              <h2 className="font-semibold">Mejoras propuestas</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {config.improvements.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <WarningCircle size={18} weight="bold" className="text-amber-600" />
              <h2 className="font-semibold">Regla de testeo</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Esta pantalla no reemplaza el modulo actual. Sirve para validar flujo, densidad,
              filtros y jerarquia visual antes de mover cambios a las vistas reales.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
