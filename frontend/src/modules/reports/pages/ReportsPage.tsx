import { useEffect, useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import {
  Users, CurrencyEur, Wallet, TrendUp, ChartBar, Package, Megaphone, UserList, DownloadSimple,
  FilePdf, ChartLineUp, Sparkle,
} from '@phosphor-icons/react';
import ReportsIAView from '@/modules/reports-ia/components/ReportsIAView';
import { exportReportPDF } from '../lib/exportPdf';
import ReportsDownloadSection from '../components/ReportsDownloadSection';
import AsesorasPanel from '../components/AsesorasPanel';

function exportReportCSV(data, project, range) {
  const sections = [];
  const sep = row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

  sections.push(sep([`Reporte CRM — ${project || 'Todos los proyectos'}`]));
  sections.push(sep([`Período: ${range.from} → ${range.to}`]));
  sections.push('');

  sections.push(sep(['KPIs generales']));
  sections.push(sep(['Total prospectos', 'Tasa conversión', 'Ventas cobradas (€)', 'Por cobrar (€)']));
  sections.push(sep([data.leads.total, data.tasa_conversion + '%', Number(data.conversions.cobrado).toFixed(2), Number(data.conversions.por_cobrar).toFixed(2)]));
  sections.push('');

  sections.push(sep(['Pipeline de prospectos']));
  sections.push(sep(['Estado', 'Total']));
  const estados = { nuevo: 'Nuevo', por_contactar: 'Por contactar', contactado: 'Contactado', en_seguimiento: 'En seguimiento', convertido: 'Convertido', no_interesado: 'No interesado' };
  Object.entries(estados).forEach(([k, label]) => sections.push(sep([label, data.leads[k] || 0])));
  sections.push('');

  if ((data.leads_por_canal || []).length) {
    sections.push(sep(['Prospectos por canal']));
    sections.push(sep(['Canal', 'Total']));
    data.leads_por_canal.forEach(r => sections.push(sep([r.canal, r.total])));
    sections.push('');
  }

  if ((data.leads_por_gestor || []).length) {
    sections.push(sep(['Prospectos por gestor']));
    sections.push(sep(['Gestor', 'Total', 'Convertidos', 'Tasa (%)']));
    data.leads_por_gestor.forEach(r => {
      const tasa = r.total > 0 ? Math.round((r.convertidos / r.total) * 100) : 0;
      sections.push(sep([r.gestor, r.total, r.convertidos, tasa]));
    });
    sections.push('');
  }

  if ((data.top_productos || []).length) {
    sections.push(sep(['Top productos']));
    sections.push(sep(['Producto', 'Ventas', 'Facturado (€)', 'Cobrado (€)']));
    data.top_productos.forEach(p => sections.push(sep([p.producto, p.ventas, Number(p.total).toFixed(2), Number(p.cobrado).toFixed(2)])));
    sections.push('');
  }

  if ((data.ingresos_mensual || []).length) {
    sections.push(sep(['Ingresos mensuales']));
    sections.push(sep(['Mes', 'Ingresos (€)']));
    data.ingresos_mensual.forEach(r => sections.push(sep([r.mes, Number(r.ingresos).toFixed(2)])));
  }

  const csv = sections.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${project || 'crm'}-${range.from}_${range.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
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
  const [tab, setTab] = useState('crm');

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
      <div className="space-y-5">
        <PageHeader title="Reportes" subtitle="Cargando…" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted/50 rounded-md animate-pulse" />)}
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

  const isIaProject = activeProject?.type === 'ia';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Reportes"
        subtitle={activeProject ? `${activeProject.nombre}` : 'Todos los proyectos'}
        actions={
          tab === 'crm' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={range.from}
                onChange={e => setRange({ ...range, from: e.target.value })}
                aria-label="Fecha desde"
                className="h-9 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-xs text-muted-foreground">hasta</span>
              <input
                type="date"
                value={range.to}
                onChange={e => setRange({ ...range, to: e.target.value })}
                aria-label="Fecha hasta"
                className="h-9 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {data && (
                <>
                  <button
                    type="button"
                    onClick={() => exportReportCSV(data, activeProject?.nombre, range)}
                    aria-label="Exportar reporte a CSV"
                    title="Exportar CSV"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <DownloadSimple size={14} weight="bold" /> <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await exportReportPDF(data, activeProject?.nombre, range);
                      } catch (err) {
                        toast({ title: 'Error generando PDF', description: err?.message || 'Inesperado', variant: 'destructive' });
                      }
                    }}
                    aria-label="Exportar reporte a PDF"
                    title="Exportar PDF"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <FilePdf size={14} weight="bold" /> <span className="hidden sm:inline">PDF</span>
                  </button>
                </>
              )}
            </div>
          ) : null
        }
      />

      {/* Tabs — solo mostrar Análisis IA si es proyecto IA */}
      {isIaProject && (
        <div className="flex border-b border-border" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'crm'}
            onClick={() => setTab('crm')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'crm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <ChartLineUp size={14} /> Datos CRM
          </button>
          <button
            role="tab"
            aria-selected={tab === 'ia'}
            onClick={() => setTab('ia')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'ia' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Sparkle size={14} /> Análisis IA
          </button>
        </div>
      )}

      {tab === 'ia' && isIaProject && <ReportsIAView project={activeProject} />}

      {tab === 'crm' && <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total prospectos" value={data.leads.total} />
        <KpiCard icon={TrendUp} label="Tasa conversión" value={`${data.tasa_conversion}%`} tone="success" />
        <KpiCard icon={CurrencyEur} label="Ventas cobradas" value={fmt(data.conversions.cobrado)} tone="success" />
        <KpiCard icon={Wallet} label="Por cobrar" value={fmt(data.conversions.por_cobrar)} tone="warning" />
      </div>

      {/* Descargable combinado prospectos + ventas (para análisis del owner) */}
      {/* Los numeros por asesora. El detalle se baja en la seccion de abajo. */}
      <AsesorasPanel from={range.from} to={range.to} />

      <ReportsDownloadSection projectId={activeProject?.id} projectName={activeProject?.nombre} from={range.from} to={range.to} />

      {/* Pipeline de leads + ingresos mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><UserList size={16} /> Prospectos por estado</h3>
          {data.leads.total === 0 ? (
            <EmptyState icon={Users} title="Sin prospectos" description="No hay prospectos en el rango seleccionado." />
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

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ChartBar size={16} /> Ingresos mensuales (12 meses)</h3>
          {(data.ingresos_mensual || []).length === 0 ? (
            <EmptyState icon={CurrencyEur} title="Sin ingresos" description="No hay ingresos registrados." />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Megaphone size={16} /> Prospectos por canal</h3>
          {(data.leads_por_canal || []).length === 0 ? (
            <EmptyState icon={Megaphone} title="Sin datos" description="No hay prospectos clasificados por canal." />
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

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users size={16} /> Prospectos por gestor</h3>
          {(data.leads_por_gestor || []).length === 0 ? (
            <EmptyState icon={Users} title="Sin datos" description="No hay prospectos asignados." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide">Gestor</th>
                      <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Prospectos</th>
                      <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Convertidos</th>
                      <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads_por_gestor.map(g => {
                      const tasa = g.total > 0 ? Math.round((g.convertidos / g.total) * 100) : 0;
                      return (
                        <tr key={g.gestor} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-semibold">{g.gestor}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.total}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{g.convertidos}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{tasa}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {data.leads_por_gestor.map(g => {
                  const tasa = g.total > 0 ? Math.round((g.convertidos / g.total) * 100) : 0;
                  return (
                    <div key={g.gestor} className="bg-muted/30 border border-border rounded-lg p-3">
                      <p className="text-sm font-semibold mb-2 truncate">{g.gestor}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px]">Prospectos</p>
                          <p className="tabular-nums font-semibold">{g.total}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Convertidos</p>
                          <p className="tabular-nums font-semibold text-green-600 dark:text-green-400">{g.convertidos}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Tasa</p>
                          <p className="tabular-nums font-semibold">{tasa}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Package size={16} /> Top productos por ventas</h3>
        {(data.top_productos || []).length === 0 ? (
          <EmptyState icon={Package} title="Sin ventas" description="No hay conversiones en el rango seleccionado." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide">Producto</th>
                    <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Ventas</th>
                    <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Facturado</th>
                    <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide">Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_productos.map((p, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold">{p.producto}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.ventas}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(p.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(p.cobrado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {data.top_productos.map((p, i) => (
                <div key={i} className="bg-muted/30 border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold truncate">{p.producto}</p>
                    <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">{p.ventas} venta{p.ventas !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Facturado</p>
                      <p className="tabular-nums font-semibold">{fmt(p.total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px]">Cobrado</p>
                      <p className="tabular-nums font-semibold text-green-600 dark:text-green-400">{fmt(p.cobrado)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </>}
    </div>
  );
}
