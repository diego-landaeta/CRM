import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '@/shared/api/client';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { CurrencyEur, ArrowRight } from '@phosphor-icons/react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'; }

export default function IncomePage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = activeProject?.id ? `?projectId=${activeProject.id}&limit=100` : '?limit=100';
        const res = await client.get(`/conversions${params}`);
        if (res.success) setItems(res.data || []);
      } catch {
        setItems([]);
      } finally { setLoading(false); }
    })();
  }, [activeProject?.id]);

  const totalFacturado = items.reduce((s, r) => s + Number(r.importe_total || 0), 0);
  const totalCobrado = items.reduce((s, r) => s + Number(r.importe_pagado || 0), 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Ingresos" subtitle={`Todas las ventas registradas${activeProject ? ' en ' + activeProject.nombre : ''}`} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Ventas</p>
          <p className="text-2xl font-semibold">{items.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Facturado</p>
          <p className="text-2xl font-semibold">{fmt(totalFacturado)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Cobrado</p>
          <p className="text-2xl font-semibold text-green-600">{fmt(totalCobrado)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState icon={CurrencyEur} title="Sin ventas" description="Las conversiones apareceran aqui cuando un lead compre" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Fecha</th>
                    <th className="text-left px-4 py-2.5 font-bold">Cliente</th>
                    <th className="text-left px-4 py-2.5 font-bold">Producto</th>
                    <th className="text-right px-4 py-2.5 font-bold">Total</th>
                    <th className="text-right px-4 py-2.5 font-bold">Pagado</th>
                    <th className="text-left px-4 py-2.5 font-bold">Estado</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${r.lead_id}`)}>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.fecha_compra)}</td>
                      <td className="px-4 py-3 font-semibold">{r.lead_nombre}</td>
                      <td className="px-4 py-3">{r.producto_contratado}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.importe_total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmt(r.importe_pagado)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.estado_pago === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                          r.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                        }`}>{r.estado_pago}</span>
                      </td>
                      <td className="px-4 py-3 text-right"><ArrowRight size={14} className="text-muted-foreground inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {items.map(r => (
                <button key={r.id} type="button" onClick={() => navigate(`/leads/${r.lead_id}`)} className="w-full text-left p-4 space-y-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.lead_nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.producto_contratado}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      r.estado_pago === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      r.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                    }`}>{r.estado_pago}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-xs text-muted-foreground">{formatDate(r.fecha_compra)}</div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-green-600">{fmt(r.importe_pagado)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="tabular-nums">{fmt(r.importe_total)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
