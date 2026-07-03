import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useDashboard } from '@/shared/hooks/useDashboard';
import { useStripeMonitor } from '@/modules/ia-dashboard/hooks/useStripeMonitor';

const LeadDrawer = lazy(() => import('@/modules/leads/components/LeadDrawer'));
import {
  Users,
  Sparkle,
  CheckCircle,
  ChartLineUp,
  ChartBar,
  ArrowRight,
  WarningCircle,
  ArrowClockwise,
  CurrencyEur,
  TrendDown,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  CreditCard,
  Clock,
  Wallet,
  Broadcast,
} from '@phosphor-icons/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import StatusBadge from '@/shared/components/ui/StatusBadge';
import ChannelBadge, { CHANNEL_LABELS } from '@/shared/components/ui/ChannelBadge';
import EmptyState from '@/shared/components/ui/EmptyState';
import StatTile, { TILE_TONES } from '@/shared/components/ui/StatTile';
import SectionCard from '@/shared/components/ui/SectionCard';
import PageHeader from '@/shared/components/ui/PageHeader';
import SkeletonTable, { SkeletonCard } from '@/shared/components/ui/SkeletonTable';
import ConversionFunnel from '@/shared/components/dashboard/ConversionFunnel';
import PerformanceInsights from '@/shared/components/dashboard/PerformanceInsights';
import { cn } from '@/shared/lib/utils';
const TopProductsCard = lazy(() => import('@/modules/sales/components/TopProductsCard'));

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
      {label}: <span className="text-cyan-300">{payload[0].value} {suffix}</span>
    </div>
  );
}

function fmtMoney(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function fmtNum(n) { return new Intl.NumberFormat('es-ES').format(Number(n || 0)); }
function fmtPct(n) { return `${(Number(n) || 0).toFixed(2)}%`; }

function SaasMonitor({ projectId }) {
  const { metrics, mrrDelta, subsDelta, loading } = useStripeMonitor(projectId);
  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!metrics || metrics.mrr === 0) return null;
  return (
    <SectionCard icon={CreditCard} tone="violet" title="Monitor SaaS — Stripe" subtitle="Métricas de suscripción en tiempo real" bodyClassName="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={CurrencyEur} tone="violet" label="MRR actual" value={fmtMoney(metrics.mrr)} delta={mrrDelta ? (mrrDelta.growing ? mrrDelta.pct : -mrrDelta.pct) : null} />
        <StatTile icon={Users} tone="blue" label="Suscripciones activas" value={fmtNum(metrics.activeSubs)} delta={subsDelta ? (subsDelta.growing ? subsDelta.pct : -subsDelta.pct) : null} />
        <StatTile icon={TrendDown} tone={metrics.churnRate > 5 ? 'rose' : 'emerald'} label="Churn rate" value={fmtPct(metrics.churnRate)} />
        <StatTile icon={WarningCircle} tone={metrics.failedPayments > 0 ? 'amber' : 'slate'} label="Cobros fallidos" value={fmtNum(metrics.failedPayments)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ArrowUpIcon size={16} weight="bold" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wide">Nuevas suscripciones (mes)</p>
            <p className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">+{metrics.newSubs}</p>
          </div>
        </div>
        <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <ArrowDownIcon size={16} weight="bold" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wide">Cancelaciones (mes)</p>
            <p className="text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400">−{metrics.cancelledSubs}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const { stats, leadsRecientes, today, loading, error, refetch } = useDashboard();
  const [drawerLeadId, setDrawerLeadId] = useState(null);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Cargando datos..." />
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Resumen de actividad" />
        <div className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-8 text-center">
          <WarningCircle size={40} className="text-rose-500 mx-auto mb-3" weight="regular" />
          <p className="text-sm text-rose-600 dark:text-rose-400 font-semibold mb-1">No se pudieron cargar los datos</p>
          <p className="text-xs text-rose-500/80 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:ring-offset-2"
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
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`${todayDate} · ${activeProject?.nombre || 'Sin proyecto'}`}
      />

      {/* SECCIÓN HOY */}
      {today && (
        <SectionCard
          icon={Clock}
          tone="cyan"
          title="Tu día de hoy"
          subtitle="Seguimientos pendientes y actividad del día"
          bodyClassName="space-y-4"
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile icon={Clock} tone="orange" label="Pendientes" value={today.reminders_pendientes?.length || 0} hint="reminders hoy" onClick={() => navigate('/prospectos?qf=urgent')} />
            <StatTile icon={Sparkle} tone="blue" label="Nuevos" value={today.nuevos_hoy || 0} hint={`hoy (${today.nuevos_semana || 0} semana)`} onClick={() => navigate('/prospectos')} />
            <StatTile icon={WarningCircle} tone="amber" label="Inactivos" value={today.inactivos || 0} hint="sin actividad" onClick={() => navigate('/prospectos?qf=no-contact')} />
            <StatTile icon={CurrencyEur} tone="rose" label="Cobros vencidos" value={today.cobros_vencidos || 0} hint="pagos atrasados" onClick={() => navigate('/finanzas/por-cobrar')} />
            <StatTile icon={Wallet} tone="emerald" label="Ingresos hoy" value={fmtMoney(today.ingresos_hoy || 0)} hint="cobrado hoy" onClick={() => navigate('/finanzas/ingresos')} />
          </div>

          {today.reminders_pendientes && today.reminders_pendientes.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Seguimientos pendientes</h3>
              <div className="space-y-2">
                {today.reminders_pendientes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setDrawerLeadId(r.lead_id)}
                    className="w-full text-left bg-muted/40 hover:bg-muted/70 border border-border rounded-xl p-3 transition-colors flex items-center gap-3"
                  >
                    <div className={cn('w-1.5 h-10 rounded-full flex-shrink-0', r.vencido ? 'bg-rose-500' : 'bg-orange-500')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{r.lead_nombre}</span>
                        {r.vencido && <span className="text-[9px] font-bold bg-rose-500/12 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">VENCIDO</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{r.nota || 'Sin nota'}</p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
                {today.reminders_pendientes.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">
                    + {today.reminders_pendientes.length - 5} más pendientes
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center">
              <CheckCircle size={22} className="text-emerald-500 mx-auto mb-1.5" weight="duotone" />
              <p className="text-sm font-semibold">Nada pendiente para hoy</p>
              <p className="text-xs text-muted-foreground">Al día con los seguimientos</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} tone="blue" label="Total prospectos" value={fmtNum(total)} />
        <StatTile icon={Sparkle} tone="orange" label="Nuevos" value={fmtNum(nuevos)} />
        <StatTile icon={CheckCircle} tone="violet" label="Convertidos" value={fmtNum(convertidos)} delta={Number(tasa) || 0} />
        <StatTile icon={ChartLineUp} tone="emerald" label="Tasa conversión" value={`${Math.round(Number(tasa) || 0)}%`} />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={ChartBar} tone="cyan" title="Prospectos por estado" subtitle="Distribución actual del pipeline">
          {total === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200} minHeight={180}>
              <BarChart data={statusBarData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 600 }} className="text-muted-foreground" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusBarData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_BAR_COLORS[entry.key] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard icon={Broadcast} tone="blue" title="Prospectos por canal" subtitle="Orígenes de los prospectos recientes">
          {channelBarData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200} minHeight={180}>
              <BarChart data={channelBarData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" allowDecimals={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 600 }} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {channelBarData.map((entry) => (
                    <Cell key={entry.key} fill={CHANNEL_BAR_COLORS[entry.key] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Embudo + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ConversionFunnel stats={stats} total={total} />
        </div>
        <div className="lg:col-span-2">
          <PerformanceInsights stats={stats} today={today} recentLeads={leadsRecientes} />
        </div>
      </div>

      {/* Programas más vendidos */}
      <Suspense fallback={null}>
        <TopProductsCard projectId={activeProject?.id} days={null} limit={5} />
      </Suspense>

      {/* Monitor SaaS — solo proyectos IA */}
      {activeProject?.type === 'ia' && <SaasMonitor projectId={activeProject.id} />}

      {/* Prospectos recientes */}
      <SectionCard
        icon={Users}
        tone="cyan"
        title="Prospectos recientes"
        subtitle="Últimos 10 prospectos registrados"
        noPadding
        action={
          <button
            onClick={() => navigate('/prospectos')}
            aria-label="Ver todos los prospectos"
            className="h-9 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border bg-card px-3 rounded-lg hover:bg-muted transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          >
            <span className="hidden sm:inline">Ver todos</span> <ArrowRight size={12} weight="bold" />
          </button>
        }
      >
        {leadsRecientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin prospectos registrados"
            description="Aún no hay prospectos para este proyecto. Aparecerán aquí cuando alguien complete un formulario o llegue vía webhook."
            action={
              <button
                onClick={() => navigate('/prospectos')}
                className="text-xs font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded"
              >
                Ir a Gestión de Prospectos
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Nombre</th>
                    <th className="px-5 py-2.5 text-left">Email</th>
                    <th className="px-5 py-2.5 text-left">Origen</th>
                    <th className="px-5 py-2.5 text-left">Estado</th>
                    <th className="px-5 py-2.5 text-left">Gestor</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsRecientes.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setDrawerLeadId(lead.id)}
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

            <div className="md:hidden divide-y divide-border">
              {leadsRecientes.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 space-y-2 cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => setDrawerLeadId(lead.id)}
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
      </SectionCard>

      <Suspense fallback={null}>
        <LeadDrawer
          leadId={drawerLeadId}
          open={drawerLeadId !== null}
          onClose={() => setDrawerLeadId(null)}
        />
      </Suspense>
    </div>
  );
}
