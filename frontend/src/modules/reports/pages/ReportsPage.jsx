import { useEffect, useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import {
  Users, CurrencyEur, Wallet, TrendUp, ChartBar, Package, Megaphone, UserList, DownloadSimple,
  ChartLineUp, Sparkle,
} from '@phosphor-icons/react';
import { useReportsIA } from '@/modules/reports-ia/hooks/useReportsIA';
import { exportReportPdf } from '@/modules/reports-ia/api/reports-ia.api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText, ClockCounterClockwise, FilePdf, CircleNotch, WarningCircle, Robot,
} from '@phosphor-icons/react';

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

function fmtPeriodo(p) {
  if (!p) return '';
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function fmtDateIA(s) {
  return s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

function ReportsIATab({ project }) {
  const { user } = useAuth();
  const reportsIA = useReportsIA(project?.id);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  async function handleGenerate() {
    try {
      await reportsIA.generate();
      toast({ title: 'Reporte generado', description: 'Claude AI analizó los datos del periodo' });
    } catch (err) {
      toast({ title: 'Error generando reporte', description: err.message, variant: 'destructive' });
    }
  }

  async function handleExportPdf() {
    if (!reportsIA.selected) return;
    setPdfLoading(true);
    try {
      const slug = (project?.slug || 'proyecto').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const filename = `reporte-${slug}-${reportsIA.selected.periodo}.pdf`;
      await exportReportPdf(reportsIA.selected.id, { filename });
      toast({ title: 'PDF descargado', description: filename });
    } catch (err) {
      toast({ title: 'Error generando PDF', description: err.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={reportsIA.generating}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {reportsIA.generating ? <CircleNotch size={14} className="animate-spin" weight="bold" /> : <Sparkle size={14} weight="bold" />}
            {reportsIA.generating ? 'Generando...' : 'Generar ahora'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:gap-6">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ClockCounterClockwise size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Historial</h3>
            <span className="ml-auto text-xs text-muted-foreground">{reportsIA.reports.length}</span>
          </div>
          {reportsIA.loading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : reportsIA.reports.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={28} weight="regular" className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sin reportes aún</p>
              {isAdmin && (
                <button onClick={handleGenerate} className="mt-3 text-xs text-primary font-semibold hover:underline">
                  Generar el primero
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[60vh] lg:max-h-[calc(100vh-300px)] overflow-y-auto">
              {reportsIA.reports.map(r => {
                const active = reportsIA.selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => reportsIA.selectReport(r.id)}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${active ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                  >
                    <div className="text-sm font-semibold capitalize">{fmtPeriodo(r.periodo)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDateIA(r.createdAt)} · por {r.generadoPor?.nombre}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg min-w-0">
          {reportsIA.error ? (
            <div className="p-8 text-center">
              <WarningCircle size={28} className="text-red-500 mx-auto mb-2" weight="regular" />
              <p className="text-red-600 font-semibold">Error</p>
              <p className="text-xs text-muted-foreground mt-1">{reportsIA.error}</p>
            </div>
          ) : !reportsIA.selected ? (
            reportsIA.generating ? (
              <div className="p-12 text-center">
                <CircleNotch size={32} className="animate-spin text-primary mx-auto mb-3" />
                <p className="font-semibold">Claude AI está analizando los datos</p>
                <p className="text-xs text-muted-foreground mt-1">Esto puede tardar 10-30 segundos</p>
              </div>
            ) : (
              <EmptyState icon={Sparkle}
                title="Sin reporte seleccionado"
                description={isAdmin ? 'Genera el primer reporte mensual con Claude AI o selecciona uno del historial' : 'Aún no se ha generado ningún reporte para este periodo'} />
            )
          ) : (
            <>
              <div className="px-5 lg:px-6 py-4 border-b border-border flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold capitalize truncate">{fmtPeriodo(reportsIA.selected.periodo)}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Generado {fmtDateIA(reportsIA.selected.createdAt)}</span>
                    <span>· por {reportsIA.selected.generadoPor?.nombre}</span>
                    {reportsIA.selected.metadata && (
                      <>
                        <span>· {reportsIA.selected.metadata.leadsAnalizados} leads</span>
                        <span>· {reportsIA.selected.metadata.conversionesAnalizadas} conv</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleExportPdf}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {pdfLoading ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : <FilePdf size={14} weight="bold" />}
                  {pdfLoading ? 'Generando…' : 'Exportar PDF'}
                </button>
              </div>
              <div className="p-5 lg:p-8 overflow-x-auto">
                <article className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportsIA.selected.content}</ReactMarkdown>
                </article>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const isIaProject = activeProject?.type === 'ia';

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Reportes"
        subtitle={activeProject ? `${activeProject.nombre}` : 'Todos los proyectos'}
        actions={
          tab === 'crm' ? (
            <div className="flex items-center gap-2">
              <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
              <span className="text-xs text-muted-foreground">hasta</span>
              <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
              {data && (
                <button
                  onClick={() => exportReportCSV(data, activeProject?.nombre, range)}
                  title="Exportar CSV"
                  className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <DownloadSimple size={14} weight="bold" /> CSV
                </button>
              )}
            </div>
          ) : null
        }
      />

      {/* Tabs — solo mostrar Análisis IA si es proyecto IA */}
      {isIaProject && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('crm')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${tab === 'crm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <ChartLineUp size={14} /> Datos CRM
          </button>
          <button
            onClick={() => setTab('ia')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${tab === 'ia' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Sparkle size={14} /> Análisis IA
          </button>
        </div>
      )}

      {tab === 'ia' && isIaProject && <ReportsIATab project={activeProject} />}

      {tab === 'crm' && <>
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
      </>}
    </div>
  );
}
