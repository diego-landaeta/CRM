import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi } from '../api/accounting.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { CurrencyEur, WarningCircle, ArrowRight } from '@phosphor-icons/react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'; }

export default function ReceivablePage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = activeProject?.id ? { projectId: activeProject.id } : {};
        const res = await accountingApi.dashboard({ ...params, from: '2000-01-01', to: new Date().toISOString().slice(0, 10) });
        if (res.success) setItems(res.data.cuentas_por_cobrar || []);
      } finally { setLoading(false); }
    })();
  }, [activeProject?.id]);

  const total = items.reduce((s, r) => s + Number(r.importe_pendiente || 0), 0);
  const vencidas = items.filter(r => r.vencido).length;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Cuentas por cobrar" subtitle={`Facturas pendientes de cobro${activeProject ? ' en ' + activeProject.nombre : ''}`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Pendientes</p>
          <p className="text-2xl font-extrabold">{items.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Total pendiente</p>
          <p className="text-2xl font-extrabold text-orange-600">{fmt(total)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Vencidas</p>
          <p className={`text-2xl font-extrabold ${vencidas > 0 ? 'text-red-600' : ''}`}>{vencidas}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState icon={CurrencyEur} title="Todo cobrado" description="No hay cuentas pendientes en este momento" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-bold">Producto</th>
                  <th className="text-left px-4 py-2.5 font-bold">Proyecto</th>
                  <th className="text-right px-4 py-2.5 font-bold">Total</th>
                  <th className="text-right px-4 py-2.5 font-bold">Pagado</th>
                  <th className="text-right px-4 py-2.5 font-bold">Pendiente</th>
                  <th className="text-left px-4 py-2.5 font-bold">Vence</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${r.lead_id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.lead_nombre}</div>
                      <div className="text-xs text-muted-foreground">{r.lead_email}</div>
                    </td>
                    <td className="px-4 py-3">{r.producto_contratado}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.proyecto_nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(r.importe_total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmt(r.importe_pagado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-orange-600">{fmt(r.importe_pendiente)}</td>
                    <td className="px-4 py-3">
                      {r.fecha_compromiso_pago ? (
                        <span className={r.vencido ? 'text-red-600 font-semibold' : ''}>
                          {r.vencido && <WarningCircle size={12} weight="fill" className="inline mr-1" />}
                          {formatDate(r.fecha_compromiso_pago)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right"><ArrowRight size={14} className="text-muted-foreground inline" /></td>
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
