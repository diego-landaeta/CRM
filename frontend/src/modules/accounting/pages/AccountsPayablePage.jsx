import { lazy, Suspense, useEffect, useState } from 'react';
import { payableApi } from '../api/payable.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import Portal from '@/shared/components/ui/portal';
import { toast } from '@/shared/hooks/useToast';
import {
  CurrencyEur,
  Wallet,
  WarningCircle,
  Receipt,
  Plus,
  X,
  CheckCircle,
  Trash,
} from '@phosphor-icons/react';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

const CATEGORIES = ['salarios', 'alquiler', 'proveedores', 'software', 'publicidad', 'impuestos', 'servicios', 'mantenimiento', 'otros'];
const ESTADOS = [
  { v: '', label: 'Todas' },
  { v: 'pendiente', label: 'Pendientes' },
  { v: 'parcial', label: 'Parciales' },
  { v: 'pagado', label: 'Pagadas' },
  { v: 'cancelado', label: 'Canceladas' },
];

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'; }

export default function AccountsPayablePage() {
  const { activeProject } = useProjectContext();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [dialog, setDialog] = useState(null); // 'new' | { type: 'pay', payable }
  const [pendingDelete, setPendingDelete] = useState(null);
  const projId = activeProject?.id;

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (projId) params.projectId = projId;
      if (filterEstado) params.estado = filterEstado;
      const [listRes, statsRes] = await Promise.all([
        payableApi.list(params),
        payableApi.stats(projId ? { projectId: projId } : {}),
      ]);
      if (listRes.success) setItems(listRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      toast({ title: 'Error cargando', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projId, filterEstado]);

  function handleDelete(id) { setPendingDelete(id); }
  async function doDelete() {
    try {
      await payableApi.remove(pendingDelete);
      toast({ title: 'Eliminada' });
      load();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setPendingDelete(null); }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Cuentas por pagar"
        subtitle={`${activeProject ? activeProject.nombre + ' — ' : ''}Facturas y deudas con proveedores`}
        actions={
          <button
            onClick={() => setDialog('new')}
            aria-label="Nueva factura"
            className="inline-flex items-center gap-2 h-9 px-3 sm:px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Plus size={14} weight="bold" /> <span className="hidden sm:inline">Nueva factura</span>
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={Receipt}
            iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            label="Facturado"
            value={fmt(stats.total_facturado)}
          />
          <KpiCard
            icon={CheckCircle}
            iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            label="Pagado"
            value={fmt(stats.total_pagado)}
          />
          <KpiCard
            icon={Wallet}
            iconBg="bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400"
            label="Pendiente"
            value={fmt(stats.total_pendiente)}
          />
          <KpiCard
            icon={WarningCircle}
            iconBg={stats.vencidas > 0
              ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
              : 'bg-muted text-muted-foreground'}
            label="Vencidas"
            value={stats.vencidas}
          />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border overflow-x-auto">
          <div className="flex items-center gap-2 w-max">
            {ESTADOS.map(e => (
              <button
                key={e.v}
                onClick={() => setFilterEstado(e.v)}
                className={`h-9 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary/40 ${filterEstado === e.v ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={8} className="border-0" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin facturas" description="No hay cuentas por pagar registradas" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Proveedor</th>
                    <th className="text-left px-4 py-2.5 font-bold">Concepto</th>
                    <th className="text-left px-4 py-2.5 font-bold">Categoría</th>
                    <th className="text-right px-4 py-2.5 font-bold">Total</th>
                    <th className="text-right px-4 py-2.5 font-bold">Pagado</th>
                    <th className="text-right px-4 py-2.5 font-bold">Pendiente</th>
                    <th className="text-left px-4 py-2.5 font-bold">Vence</th>
                    <th className="text-left px-4 py-2.5 font-bold">Estado</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.proveedor}</div>
                        {r.proyecto_nombre && <div className="text-[10px] text-muted-foreground">{r.proyecto_nombre}</div>}
                      </td>
                      <td className="px-4 py-3">{r.concepto}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted">{r.categoria}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.importe_total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(r.importe_pagado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-orange-600 dark:text-orange-400">{fmt(r.importe_pendiente)}</td>
                      <td className="px-4 py-3">
                        {r.fecha_compromiso_pago ? (
                          <span className={r.vencido ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                            {r.vencido && <WarningCircle size={12} weight="fill" className="inline mr-1" />}
                            {formatDate(r.fecha_compromiso_pago)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.estado === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                          r.estado === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                          r.estado === 'cancelado' ? 'bg-muted text-muted-foreground' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                        }`}>{r.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.estado !== 'pagado' && r.estado !== 'cancelado' && (
                            <button
                              onClick={() => setDialog({ type: 'pay', payable: r })}
                              aria-label="Registrar pago"
                              title="Registrar pago"
                              className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-950/30 text-green-600 dark:text-green-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                              <CurrencyEur size={14} weight="bold" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.id)}
                            aria-label="Eliminar factura"
                            title="Eliminar"
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {items.map(r => (
                <div key={r.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.proveedor}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.concepto}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      r.estado === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      r.estado === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                      r.estado === 'cancelado' ? 'bg-muted text-muted-foreground' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                    }`}>{r.estado}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="tabular-nums">{fmt(r.importe_total)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Pagado</div>
                      <div className="tabular-nums text-green-600 dark:text-green-400">{fmt(r.importe_pagado)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Pendiente</div>
                      <div className="tabular-nums font-semibold text-orange-600 dark:text-orange-400">{fmt(r.importe_pendiente)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs pt-1">
                    <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                      <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium flex-shrink-0">{r.categoria}</span>
                      {r.fecha_compromiso_pago && (
                        <span className={r.vencido ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                          {r.vencido && <WarningCircle size={12} weight="fill" className="inline mr-0.5" />}
                          Vence {formatDate(r.fecha_compromiso_pago)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {r.estado !== 'pagado' && r.estado !== 'cancelado' && (
                        <button
                          onClick={() => setDialog({ type: 'pay', payable: r })}
                          aria-label="Registrar pago"
                          className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-950/30 text-green-600 dark:text-green-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <CurrencyEur size={14} weight="bold" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        aria-label="Eliminar factura"
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {dialog === 'new' && <PayableDialog projectId={projId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {dialog?.type === 'pay' && <PaymentDialog payable={dialog.payable} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
      {pendingDelete !== null && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open={pendingDelete !== null}
            title="¿Eliminar factura?"
            message="Este registro será eliminado permanentemente."
            tone="destructive"
            confirmLabel="Eliminar"
            onConfirm={doDelete}
            onCancel={() => setPendingDelete(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function PayableDialog({ projectId, onClose, onSaved }) {
  const [data, setData] = useState({
    proveedor: '', concepto: '', categoria: 'proveedores',
    importe_total: '', fecha_factura: new Date().toISOString().slice(0, 10),
    fecha_compromiso_pago: '', notas: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!data.proveedor || !data.concepto || !data.importe_total) return;
    setSaving(true);
    try {
      await payableApi.create({
        ...data,
        project_id: projectId || null,
        importe_total: Number(data.importe_total),
        fecha_compromiso_pago: data.fecha_compromiso_pago || null,
      });
      toast({ title: 'Factura creada' });
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const inputClass = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <form onSubmit={handleSubmit} className="relative bg-card rounded-lg border border-border w-full max-w-lg p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nueva factura por pagar</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Proveedor" value={data.proveedor} onChange={e => setData({ ...data, proveedor: e.target.value })} className={inputClass} />
            <select value={data.categoria} onChange={e => setData({ ...data, categoria: e.target.value })} className={inputClass}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input required placeholder="Concepto" value={data.concepto} onChange={e => setData({ ...data, concepto: e.target.value })} className={inputClass + ' col-span-2'} />
            <input required type="number" step="0.01" placeholder="Importe total" value={data.importe_total} onChange={e => setData({ ...data, importe_total: e.target.value })} className={inputClass + ' tabular-nums'} />
            <div></div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Fecha factura</label>
              <input type="date" value={data.fecha_factura} onChange={e => setData({ ...data, fecha_factura: e.target.value })} className={inputClass} required />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Vence</label>
              <input type="date" value={data.fecha_compromiso_pago} onChange={e => setData({ ...data, fecha_compromiso_pago: e.target.value })} className={inputClass} />
            </div>
            <textarea placeholder="Notas (opcional)" value={data.notas} onChange={e => setData({ ...data, notas: e.target.value })} className={inputClass + ' col-span-2 h-20 py-2 resize-none'} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {saving ? 'Guardando...' : 'Crear factura'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

function PaymentDialog({ payable, onClose, onSaved }) {
  const pendiente = Number(payable.importe_pendiente || 0);
  const [data, setData] = useState({
    importe: pendiente, fecha_pago: new Date().toISOString().slice(0, 10),
    metodo: 'transferencia', referencia: '', notas: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!data.importe) return;
    setSaving(true);
    try {
      await payableApi.addPayment(payable.id, { ...data, importe: Number(data.importe) });
      toast({ title: 'Pago registrado' });
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const inputClass = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <form onSubmit={handleSubmit} className="relative bg-card rounded-lg border border-border w-full max-w-md p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Registrar pago</h2>
              <p className="text-xs text-muted-foreground">{payable.proveedor} — {payable.concepto}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1 tabular-nums">Pendiente: {fmt(pendiente)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Importe</label>
              <input required type="number" step="0.01" max={pendiente} value={data.importe} onChange={e => setData({ ...data, importe: e.target.value })} className={inputClass + ' tabular-nums'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Fecha</label>
                <input type="date" value={data.fecha_pago} onChange={e => setData({ ...data, fecha_pago: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">Método</label>
                <select value={data.metodo} onChange={e => setData({ ...data, metodo: e.target.value })} className={inputClass}>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>
            <input placeholder="Referencia (opcional)" value={data.referencia} onChange={e => setData({ ...data, referencia: e.target.value })} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {saving ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
