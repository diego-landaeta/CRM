import { useEffect, useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import {
  Users, CurrencyEur, Wallet, TrendUp, ChartBar, Package, Megaphone, UserList,
} from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}

const CANAL_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#ef4444', '#94a3b8'];
const PIPELINE_COLORS = {
  nuevo: '#3b82f6',
  por_contactar: '#f59e0b',
  contactado: '#10b981',
  en_seguimiento: '#eab308',
  convertido: '#8b5cf6',
  no_interesado: '#ef4444',
};

export default function ReportsPage() {
  const { activeProject } = useProjectContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = { ...(activeProject?.id ? { projectId: activeProject.id } : {}), from: range.from, to: range.to };
        const qs = new URLSearchParams(params).toString();
        const res = await client.get(`/reports/overview?${qs}`);
        if (res.success) setData(res.data);
      } catch (err) {
        toast({ title: 'Error cargando reportes', description: err?.data?.error || err.message, variant: 'destructive' });
      } finally { setLoading(false); }
    }
    load();
  }, [activeProject?.id, range.from, range.to]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reportes" subtitle="Cargando..." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-md animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const pipelineData = [
    { estado: 'Nuevo', total: Number(data.leads.nuevo), color: PIPELINE_COLORS.nuevo },
    { estado: 'Por contactar', total: Number(data.leads.por_contactar), color: PIPELINE_COLORS.por_contactar },
    { estado: 'Contactado', total: Number(data.leads.contactado), color: PIPELINE_COLORS.contactado },
    { estado: 'En seguimiento', total: Number(data.leads.en_seguimiento), color: PIPELINE_COLORS.en_seguimiento },
    { estado: 'Convertido', total: Number(data.leads.convertido), color: PIPELINE_COLORS.convertido },
    { estado: 'No interesado', total: Number(data.leads.no_interesado), color: PIPELINE_COLORS.no_interesado },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Reportes"
        subtitle={activeProject ? `${activeProject.nombre}` : 'Todos los proyectos'}
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
            <span className="text-xs text-muted-foreground">hasta</span>
            <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total prospectos" value={data.leads.total} />
        <KpiCard icon={TrendUp} label="Tasa conversion" value={`${data.tasa_conversion}%`} tone="success" />
        <KpiCard icon={CurrencyEur} label="Ventas cobradas" value={fmt(data.conversions.cobrado)} tone="success" />
        <KpiCard icon={Wallet} label="Por cobrar" value={fmt(data.conversions.por_cobrar)} tone="warning" />
      </div>

      {/* Pipeline de leads + ingresos mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><UserList size={16} /> Prospectos por estado</h3>
          {data.leads.total === 0 ? (
            <EmptyState icon={Users} title="Sin prospectos" description="No hay prospectos en el rango seleccionado" />
          ) : (
            <ResponsiveContainer width="100%" height={220} minHeight={200}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="estado" stroke="#6b7280" fontSize={12} width={100} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><ChartBar size={16} /> Ingresos mensual (12 meses)</h3>
          {(data.ingresos_mensual || []).length === 0 ? (
            <EmptyState icon={CurrencyEur} title="Sin ingresos" description="No hay ingresos registrados" />
          ) : (
            <ResponsiveContainer width="100%" height={220} minHeight={200}>
              <LineChart data={data.ingresos_mensual} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#f3f4f6" />
                <XAxis dataKey="mes" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v?.slice(5) || v} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Por canal + por gestor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Megaphone size={16} /> Prospectos por canal</h3>
          {(data.leads_por_canal || []).length === 0 ? (
            <EmptyState icon={Megaphone} title="Sin datos" description="No hay prospectos clasificados por canal" />
          ) : (
            <ResponsiveContainer width="100%" height={220} minHeight={200}>
              <PieChart>
                <Pie data={data.leads_por_canal} dataKey="total" nameKey="canal" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {data.leads_por_canal.map((e, i) => <Cell key={i} fill={CANAL_COLORS[i % CANAL_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={16} /> Prospectos por gestor</h3>
          {(data.leads_por_gestor || []).length === 0 ? (
            <EmptyState icon={Users} title="Sin datos" description="No hay prospectos asignados" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Gestor</th>
                    <th className="text-right px-3 py-2 font-bold">Prospectos</th>
                    <th className="text-right px-3 py-2 font-bold">Convertidos</th>
                    <th className="text-right px-3 py-2 font-bold">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads_por_gestor.map(g => {
                    const tasa = g.total > 0 ? Math.round((g.convertidos / g.total) * 100) : 0;
                    return (
                      <tr key={g.gestor} className="border-b last:border-0">
                        <td className="px-3 py-2 font-semibold">{g.gestor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{g.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-600">{g.convertidos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{tasa}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Package size={16} /> Top productos por ventas</h3>
        {(data.top_productos || []).length === 0 ? (
          <EmptyState icon={Package} title="Sin ventas" description="No hay conversiones en el rango seleccionado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">Producto</th>
                  <th className="text-right px-3 py-2 font-bold">Ventas</th>
                  <th className="text-right px-3 py-2 font-bold">Facturado</th>
                  <th className="text-right px-3 py-2 font-bold">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {data.top_productos.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2 font-semibold">{p.producto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.ventas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-600">{fmt(p.cobrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
