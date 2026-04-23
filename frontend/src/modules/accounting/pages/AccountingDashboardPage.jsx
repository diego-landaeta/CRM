import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi } from '../api/accounting.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import {
  CurrencyEur,
  Wallet,
  TrendUp,
  TrendDown,
  WarningCircle,
  Receipt,
  ArrowRight,
  Plus,
} from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}

function formatDate(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AccountingDashboardPage() {
  const navigate = useNavigate();
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
        const res = await accountingApi.dashboard({
          ...(activeProject?.id ? { projectId: activeProject.id } : {}),
          from: range.from,
          to: range.to,
        });
        if (res.success) setData(res.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeProject?.id, range.from, range.to]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contabilidad" subtitle="Cargando..." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { ingresos, egresos, balance, cuentas_por_cobrar, trend } = data;

  // Merge trend ingresos + egresos
  const mesesSet = new Set([...trend.ingresos.map(x => x.mes), ...trend.egresos.map(x => x.mes)]);
  const meses = Array.from(mesesSet).sort();
  const trendData = meses.map(m => ({
    mes: m.slice(5),
    ingresos: trend.ingresos.find(x => x.mes === m)?.total || 0,
    egresos: trend.egresos.find(x => x.mes === m)?.total || 0,
  }));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Contabilidad"
        subtitle={activeProject ? `${activeProject.nombre}` : 'Todos los proyectos'}
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
            <span className="text-xs text-muted-foreground">hasta</span>
            <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className="h-9 px-3 rounded-lg border border-border bg-card text-sm" />
            <button onClick={() => navigate('/accounting/expenses')} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
              <Plus size={14} weight="bold" /> Egreso
            </button>
          </div>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={CurrencyEur}
          label="Ingresos cobrados"
          value={fmt(ingresos.total_cobrado)}
          tone="success"
        />
        <KpiCard
          icon={Wallet}
          label="Por cobrar"
          value={fmt(ingresos.total_pendiente)}
          tone="warning"
        />
        <KpiCard
          icon={TrendDown}
          label="Egresos"
          value={fmt(egresos.total)}
          tone="destructive"
        />
        <KpiCard
          icon={balance >= 0 ? TrendUp : TrendDown}
          label="Balance neto"
          value={fmt(balance)}
          tone={balance >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {/* Graficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4">Evolucion mensual (12 meses)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} name="Ingresos" />
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} name="Egresos" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4">Egresos por categoria</h3>
          {egresos.por_categoria.length === 0 ? (
            <EmptyState icon={Receipt} title="Sin egresos" description="No hay gastos registrados en este periodo" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={egresos.por_categoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                <YAxis type="category" dataKey="categoria" stroke="#6b7280" fontSize={11} width={100} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cuentas por cobrar */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Cuentas por cobrar ({cuentas_por_cobrar.length})</h3>
          {cuentas_por_cobrar.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Total pendiente: <span className="font-bold text-orange-600">{fmt(cuentas_por_cobrar.reduce((s, r) => s + Number(r.importe_pendiente), 0))}</span>
            </div>
          )}
        </div>

        {cuentas_por_cobrar.length === 0 ? (
          <EmptyState icon={CurrencyEur} title="Todo cobrado" description="No hay cuentas pendientes en este momento" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5 font-bold">Lead</th>
                  <th className="text-left px-5 py-2.5 font-bold">Producto</th>
                  <th className="text-left px-5 py-2.5 font-bold">Proyecto</th>
                  <th className="text-right px-5 py-2.5 font-bold">Total</th>
                  <th className="text-right px-5 py-2.5 font-bold">Pagado</th>
                  <th className="text-right px-5 py-2.5 font-bold">Pendiente</th>
                  <th className="text-left px-5 py-2.5 font-bold">Vence</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {cuentas_por_cobrar.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${r.lead_id}`)}>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{r.lead_nombre}</div>
                      <div className="text-xs text-muted-foreground">{r.lead_email}</div>
                    </td>
                    <td className="px-5 py-3">{r.producto_contratado}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.proyecto_nombre}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmt(r.importe_total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-green-600">{fmt(r.importe_pagado)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-orange-600">{fmt(r.importe_pendiente)}</td>
                    <td className="px-5 py-3">
                      {r.fecha_compromiso_pago ? (
                        <span className={r.vencido ? 'text-red-600 font-semibold' : ''}>
                          {r.vencido && <WarningCircle size={12} weight="fill" className="inline mr-1" />}
                          {formatDate(r.fecha_compromiso_pago)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin fecha</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ArrowRight size={14} className="text-muted-foreground inline" />
                    </td>
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
