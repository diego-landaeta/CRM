import { useState } from 'react';
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
} from '@phosphor-icons/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const ESTADO_STYLES = {
  nuevo: 'bg-blue-50 text-blue-600',
  por_contactar: 'bg-orange-50 text-orange-600',
  contactado: 'bg-emerald-50 text-emerald-600',
  en_seguimiento: 'bg-amber-50 text-amber-600',
  convertido: 'bg-violet-50 text-violet-600',
  no_interesado: 'bg-red-50 text-red-600',
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
    <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={20} weight="duotone" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${badgeColor}`}>
          <TrendIcon size={12} weight="bold" />
          {badge}
        </span>
      </div>
      <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">{label}</p>
      <h3 className="text-3xl font-extrabold mt-1 tracking-tight">{value}</h3>
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

const MONTHS = [
  { value: '2026-03', label: 'Marzo 2026' },
  { value: '2026-02', label: 'Febrero 2026' },
  { value: '2026-01', label: 'Enero 2026' },
  { value: '2025-12', label: 'Diciembre 2025' },
  { value: '2025-11', label: 'Noviembre 2025' },
  { value: '2025-10', label: 'Octubre 2025' },
];

export default function DashboardPage() {
  const { activeProject } = useProjectContext();
  const { kpis, leadsSemana, conversionProyecto, leadsRecientes } = useDashboard();
  const [selectedMonth, setSelectedMonth] = useState('2026-03');

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Resumen de actividad &mdash; {activeProject.nombre}
          </p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10 px-4 pr-9 rounded-xl border border-border bg-card text-sm font-medium outline-none cursor-pointer appearance-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={UserPlus}
          iconBg="bg-blue-50 text-blue-600"
          label="Leads Nuevos"
          value={kpis.leadsNuevos.value}
          badge={kpis.leadsNuevos.change}
          badgeColor="bg-emerald-50 text-emerald-600"
          trend="up"
        />
        <KpiCard
          icon={CheckCircle}
          iconBg="bg-violet-50 text-violet-600"
          label="Conversiones"
          value={kpis.conversiones.value}
          badge={kpis.conversiones.rate}
          badgeColor="bg-violet-50 text-violet-600"
          trend="up"
        />
        <KpiCard
          icon={CurrencyEur}
          iconBg="bg-emerald-50 text-emerald-600"
          label="Ingresos Mes"
          value={`${kpis.ingresosMes.value.toLocaleString('es-ES')} €`}
          badge={kpis.ingresosMes.change}
          badgeColor="bg-emerald-50 text-emerald-600"
          trend="up"
        />
        <KpiCard
          icon={UserMinus}
          iconBg="bg-red-50 text-red-500"
          label="Tasa Abandono"
          value={`${kpis.tasaAbandono.value}%`}
          badge={kpis.tasaAbandono.change}
          badgeColor="bg-red-50 text-red-600"
          trend="down"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Bar Chart */}
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] md:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold">Leads por Semana</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Marzo 2026</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={leadsSemana} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="semana"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="leads" radius={[8, 8, 0, 0]} fill="#4361ee" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] md:col-span-2">
          <h3 className="font-bold mb-1">Conversion por Proyecto</h3>
          <p className="text-[11px] text-muted-foreground mb-4">Tasa acumulada</p>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={conversionProyecto}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {conversionProyecto.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            {conversionProyecto.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="font-bold">{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-x-auto">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Leads Recientes</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ultimos 7 dias</p>
          </div>
          <button className="text-xs font-semibold text-zinc-600 border border-border bg-card px-3 py-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
            Ver todos <ArrowRight size={12} weight="bold" />
          </button>
        </div>
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
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{lead.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{lead.email}</td>
                  <td className="px-5 py-3">
                    <span className="bg-muted text-zinc-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                      {lead.origen}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado]}`}>
                      {ESTADO_LABELS[lead.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{lead.gestor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {leadsRecientes.map((lead) => (
            <div key={lead.id} className="p-4 space-y-2">
              <p className="text-[13px] font-semibold">{lead.nombre}</p>
              <p className="text-[13px] text-muted-foreground">{lead.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado]}`}>
                  {ESTADO_LABELS[lead.estado]}
                </span>
                <span className="text-[12px] text-muted-foreground">{lead.gestor}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
