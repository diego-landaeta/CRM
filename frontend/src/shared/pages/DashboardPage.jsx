import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useDashboard } from '@/shared/hooks/useDashboard';
import {
  Users,
  Sparkle,
  CheckCircle,
  ChartLineUp,
  ArrowRight,
  WarningCircle,
  ArrowClockwise,
} from '@phosphor-icons/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import StatusBadge, { STATUS_STYLES } from '@/shared/components/ui/StatusBadge';
import ChannelBadge, { CHANNEL_LABELS } from '@/shared/components/ui/ChannelBadge';
import EmptyState from '@/shared/components/ui/EmptyState';
import KpiCard from '@/shared/components/ui/KpiCard';
import PageHeader from '@/shared/components/ui/PageHeader';
import SkeletonTable, { SkeletonCard } from '@/shared/components/ui/SkeletonTable';

const STATUS_BAR_COLORS = {
  nuevo: '#3b82f6',
  por_contactar: '#ea580c',
  contactado: '#059669',
  en_seguimiento: '#d97706',
  convertido: '#7c3aed',
  no_interesado: '#dc2626',
};

const CHANNEL_BAR_COLORS = {
  meta_ads: '#3b82f6',
  google_ads: '#eab308',
  tiktok_ads: '#ec4899',
  organico: '#10b981',
  chatgpt_ia: '#8b5cf6',
  directo: '#0ea5e9',
  referido: '#14b8a6',
  otro: '#64748b',
};

function CustomTooltip({ active, payload, label, suffix = 'leads' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg">
      {label}: <span className="text-blue-300">{payload[0].value} {suffix}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const { kpis, stats, leadsRecientes, today, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" subtitle="Cargando datos..." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" subtitle="Resumen de actividad" />
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
          <WarningCircle size={40} className="text-red-500 mx-auto mb-3" weight="duotone" />
          <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-1">No se pudieron cargar los datos</p>
          <p className="text-xs text-red-500/80 dark:text-red-400/80 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2"
          >
            <ArrowClockwise size={12} weight="bold" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  const total = stats.total || 0;
  const nuevos = (stats.nuevo || 0) + (stats.por_contactar || 0);
  const convertidos = stats.convertido || 0;
  const tasa = stats.conversionRate || 0;

  const statusBarData = [
    { key: 'nuevo', name: 'Nuevo', value: stats.nuevo || 0 },
    { key: 'por_contactar', name: 'Por contactar', value: stats.por_contactar || 0 },
    { key: 'contactado', name: 'Contactado', value: stats.contactado || 0 },
    { key: 'en_seguimiento', name: 'Seguimiento', value: stats.en_seguimiento || 0 },
    { key: 'convertido', name: 'Convertido', value: stats.convertido || 0 },
    { key: 'no_interesado', name: 'No interes.', value: stats.no_interesado || 0 },
  ];

  // Channel aggregation from recent leads (fallback display)
  const channelMap = {};
  for (const lead of leadsRecientes) {
    const k = lead.origen || 'otro';
    channelMap[k] = (channelMap[k] || 0) + 1;
  }
  const channelBarData = Object.entries(channelMap)
    .map(([k, v]) => ({ key: k, name: CHANNEL_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  const todayDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={`${todayDate} - ${activeProject?.nombre || 'Sin proyecto'}`}
      />

      {/* SECCION HOY */}
      {today && (
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">Tu dia de hoy</h2>
              <p className="text-xs text-muted-foreground">Seguimientos pendientes y actividad del dia</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold tabular-nums text-orange-600">{today.reminders_pendientes?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground">reminders hoy</p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Nuevos</p>
              <p className="text-2xl font-bold tabular-nums text-blue-600">{today.nuevos_hoy || 0}</p>
              <p className="text-[10px] text-muted-foreground">hoy ({today.nuevos_semana || 0} semana)</p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Inactivos</p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{today.inactivos || 0}</p>
              <p className="text-[10px] text-muted-foreground">leads sin actividad</p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Cobros vencidos</p>
              <p className="text-2xl font-bold tabular-nums text-red-600">{today.cobros_vencidos || 0}</p>
              <p className="text-[10px] text-muted-foreground">pagos atrasados</p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Ingresos hoy</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(today.ingresos_hoy || 0)}</p>
              <p className="text-[10px] text-muted-foreground">cobrado hoy</p>
            </div>
          </div>

          {/* Reminders pendientes */}
          {today.reminders_pendientes && today.reminders_pendientes.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Seguimientos pendientes</h3>
              <div className="space-y-2">
                {today.reminders_pendientes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/leads/${r.lead_id}`)}
                    className="w-full text-left bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all flex items-center gap-3"
                  >
                    <div className={`w-2 h-10 rounded-full ${r.vencido ? 'bg-red-500' : 'bg-orange-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{r.lead_nombre}</span>
                        {r.vencido && <span className="text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">VENCIDO</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{r.nota || 'Sin nota'}</p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
                {today.reminders_pendientes.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">
                    + {today.reminders_pendientes.length - 5} mas pendientes
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <CheckCircle size={20} className="text-emerald-500 mx-auto mb-1" weight="duotone" />
              <p className="text-sm font-semibold">Nada pendiente para hoy</p>
              <p className="text-xs text-muted-foreground">Al dia con los seguimientos</p>
            </div>
          )}
        </div>
      )}

      {/* Top KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
          label="Total leads"
          value={total}
        />
        <KpiCard
          icon={Sparkle}
          iconBg="bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400"
          label="Nuevos"
          value={nuevos}
        />
        <KpiCard
          icon={CheckCircle}
          iconBg="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
          label="Convertidos"
          value={convertidos}
          badge={`${tasa}%`}
          badgeColor="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
          trend="up"
        />
        <KpiCard
          icon={ChartLineUp}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          label="Tasa conversion"
          value={`${tasa}%`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="mb-6">
            <h3 className="font-semibold">Leads por estado</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Distribucion actual del pipeline</p>
          </div>
          {total === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sin datos aun</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusBarData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusBarData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_BAR_COLORS[entry.key] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="mb-6">
            <h3 className="font-semibold">Leads por canal</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Origenes de los leads recientes</p>
          </div>
          {channelBarData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sin datos aun</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={channelBarData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {channelBarData.map((entry) => (
                    <Cell key={entry.key} fill={CHANNEL_BAR_COLORS[entry.key] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-x-auto">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Leads recientes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ultimos 10 leads registrados</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 border border-border bg-card px-3 py-1.5 rounded-lg hover:bg-muted transition-all duration-200 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          >
            Ver todos <ArrowRight size={12} weight="bold" />
          </button>
        </div>

        {leadsRecientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin leads registrados"
            description="Aun no hay leads para este proyecto. Apareceran aqui cuando alguien complete un formulario o llegue via webhook."
            action={
              <button
                onClick={() => navigate('/leads')}
                className="text-xs font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded"
              >
                Ir a Gestion de Leads
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nombre</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origen</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gestor</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsRecientes.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td className="px-5 py-3 font-semibold">{lead.nombre}</td>
                      <td className="px-5 py-3 text-muted-foreground">{lead.email}</td>
                      <td className="px-5 py-3"><ChannelBadge channel={lead.origen} /></td>
                      <td className="px-5 py-3"><StatusBadge status={lead.estado} showIcon /></td>
                      <td className="px-5 py-3 text-muted-foreground">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {leadsRecientes.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 space-y-2 cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <p className="text-[13px] font-semibold">{lead.nombre}</p>
                  <p className="text-[13px] text-muted-foreground">{lead.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={lead.estado} />
                    <ChannelBadge channel={lead.origen} />
                    <span className="text-[12px] text-muted-foreground">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
