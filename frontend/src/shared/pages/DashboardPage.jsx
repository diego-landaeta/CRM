import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useDashboard } from '@/shared/hooks/useDashboard';
import {
  UserPlus,
  CheckCircle,
  CurrencyEur,
  UserMinus,
  TrendUp,
  TrendDown,
  ArrowRight,
  Users,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const ESTADO_STYLES = {
  nuevo: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  por_contactar: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
  contactado: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  en_seguimiento: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  convertido: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  no_interesado: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
};

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  por_contactar: 'Por contactar',
  contactado: 'Contactado',
  en_seguimiento: 'En seguimiento',
  convertido: 'Convertido',
  no_interesado: 'No interesado',
};

function KpiCard({ icon: Icon, iconBg, label, value, badge, badgeColor, trend }) {
  const TrendIcon = trend === 'up' ? TrendUp : TrendDown;
  return (
    <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={20} weight="duotone" />
        </div>
        {badge !== '--' && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${badgeColor}`}>
            <TrendIcon size={12} weight="bold" />
            {badge}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">{label}</p>
      <h3 className="text-3xl font-extrabold mt-1 tracking-tight">{value}</h3>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="w-12 h-5 rounded-full bg-muted" />
      </div>
      <div className="w-20 h-3 bg-muted rounded mb-2" />
      <div className="w-16 h-8 bg-muted rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] animate-pulse">
      <div className="p-5">
        <div className="w-32 h-5 bg-muted rounded mb-1" />
        <div className="w-24 h-3 bg-muted rounded" />
      </div>
      <div className="px-5 space-y-4 pb-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-7 h-7 rounded-full bg-muted" />
            <div className="flex-1 h-4 bg-muted rounded" />
            <div className="w-16 h-4 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg">
      {label}: <span className="text-blue-300">{payload[0].value} leads</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const { kpis, leadsSemana, stats, leadsRecientes, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Cargando datos...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Resumen de actividad</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
          <WarningCircle size={32} className="text-red-500 mx-auto mb-2" weight="duotone" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Build stats bar data from stats
  const statusBarData = stats
    ? [
        { name: 'Nuevo', value: stats.nuevo || 0, fill: '#4361ee' },
        { name: 'Por contactar', value: stats.por_contactar || 0, fill: '#ea580c' },
        { name: 'Contactado', value: stats.contactado || 0, fill: '#059669' },
        { name: 'Seguimiento', value: stats.en_seguimiento || 0, fill: '#d97706' },
        { name: 'Convertido', value: stats.convertido || 0, fill: '#7c3aed' },
        { name: 'No interes.', value: stats.no_interesado || 0, fill: '#dc2626' },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Resumen de actividad &mdash; {activeProject?.nombre || 'Sin proyecto'}
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={UserPlus}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
          label="Leads Nuevos"
          value={kpis.leadsNuevos.value}
          badge={kpis.leadsNuevos.change}
          badgeColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          trend="up"
        />
        <KpiCard
          icon={CheckCircle}
          iconBg="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
          label="Conversiones"
          value={kpis.conversiones.value}
          badge={kpis.conversiones.rate}
          badgeColor="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
          trend="up"
        />
        <KpiCard
          icon={CurrencyEur}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          label="Total Leads"
          value={stats.total || 0}
          badge="--"
          badgeColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          trend="up"
        />
        <KpiCard
          icon={UserMinus}
          iconBg="bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400"
          label="No Interesados"
          value={stats.no_interesado || 0}
          badge={kpis.tasaAbandono.change}
          badgeColor="bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
          trend="down"
        />
      </div>

      {/* KPIs secundarios por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { key: 'contactado', label: 'Contactados', color: '#059669' },
          { key: 'en_seguimiento', label: 'En seguimiento', color: '#d97706' },
          { key: 'por_contactar', label: 'Por contactar', color: '#ea580c' },
          { key: 'convertido', label: 'Convertidos', color: '#7c3aed' },
          { key: 'conversionRate', label: 'Tasa conversion', color: '#4361ee', isPercent: true },
        ].map(({ key, label, color, isPercent }) => (
          <div
            key={key}
            className="bg-card px-4 py-3 rounded-2xl border border-border text-center shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] border-b-2"
            style={{ borderBottomColor: color }}
          >
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-extrabold mt-0.5" style={{ color }}>
              {stats[key] || 0}{isPercent ? '%' : ''}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {statusBarData.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="mb-6">
              <h3 className="font-bold">Leads por Estado</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Distribucion actual del pipeline</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusBarData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#4361ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-x-auto">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Leads Recientes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ultimos leads registrados</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-zinc-600 border border-border bg-card px-3 py-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            Ver todos <ArrowRight size={12} weight="bold" />
          </button>
        </div>

        {leadsRecientes.length === 0 ? (
          <div className="px-5 pb-8 pt-4 text-center">
            <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="duotone" />
            <p className="text-sm text-muted-foreground">No hay leads registrados para este proyecto</p>
            <button
              onClick={() => navigate('/leads')}
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              Ir a Gestion de Leads
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
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
                      <td className="px-5 py-3">
                        <span className="bg-muted text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                          {lead.origen}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado] || 'bg-muted text-muted-foreground'}`}>
                          {ESTADO_LABELS[lead.estado] || lead.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado] || 'bg-muted text-muted-foreground'}`}>
                      {ESTADO_LABELS[lead.estado] || lead.estado}
                    </span>
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
