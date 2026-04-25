import { useEffect, useState } from 'react';
import { commissionsApi } from '../api/commissions.api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import Portal from '@/shared/components/ui/portal';
import { toast } from '@/shared/hooks/useToast';
import {
  CurrencyEur, CheckCircle, Clock, ChartBar, Gear, X, Plus, Trash, PencilSimple,
} from '@phosphor-icons/react';
import client from '@/shared/api/client';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'; }

const ESTADOS = [
  { v: '', label: 'Todas' },
  { v: 'pendiente', label: 'Pendientes' },
  { v: 'pagado', label: 'Pagadas' },
];

const inputClass = 'h-9 px-3 rounded-lg border border-border bg-card text-sm';

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [users, setUsers] = useState([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = filterEstado ? { estado: filterEstado } : {};
      if (filterUser) params.userId = filterUser;
      const fn = isAdmin ? commissionsApi.list : commissionsApi.listMine;
      const fnStats = isAdmin ? commissionsApi.stats : commissionsApi.statsMine;
      const [listRes, statsRes] = await Promise.all([fn(params), fnStats(filterUser && isAdmin ? { userId: filterUser } : {})]);
      if (listRes.success) setItems(listRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterEstado, filterUser]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const r = await client.get('/users?role=gestor&active=true');
        if (r.success) setUsers((r.data?.users || r.data || []).filter(u => u.role !== 'superadmin'));
      } catch {}
    })();
  }, [isAdmin]);

  async function handlePay(id) {
    if (!confirm('Marcar esta comision como pagada?')) return;
    try {
      await commissionsApi.pay(id, { fecha_pago: new Date().toISOString().slice(0, 10) });
      toast({ title: 'Comision pagada' });
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={isAdmin ? 'Comisiones' : 'Mis comisiones'}
        subtitle={isAdmin ? 'Comisiones generadas a partir de las ventas (round-robin -> regla -> conversion)' : 'Tu acumulado por ventas'}
        actions={isAdmin && user?.role === 'superadmin' ? (
          <button onClick={() => setRulesOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90">
            <Gear size={14} weight="bold" /> Reglas (% por gestor)
          </button>
        ) : null}
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={ChartBar} label="Total generado" value={fmt(stats.total)} />
          <KpiCard icon={CheckCircle} label="Pagado" value={fmt(stats.pagado)} tone="success" />
          <KpiCard icon={Clock} label="Pendiente" value={fmt(stats.pendiente)} tone="warning" />
          <KpiCard icon={CurrencyEur} label="Comisiones" value={stats.cantidad} />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
          {ESTADOS.map(e => (
            <button key={e.v} onClick={() => setFilterEstado(e.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterEstado === e.v ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}>
              {e.label}
            </button>
          ))}
          {isAdmin && users.length > 0 && (
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={inputClass + ' ml-auto'}>
              <option value="">Todos los gestores</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : items.length === 0 ? (
          <EmptyState icon={CurrencyEur} title="Sin comisiones" description={isAdmin ? 'Aun no se han generado comisiones. Asegurate de tener reglas creadas.' : 'No tienes comisiones aun. Cierra ventas para empezar a acumular.'} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Fecha</th>
                    {isAdmin && <th className="text-left px-4 py-2.5 font-bold">Gestor</th>}
                    <th className="text-left px-4 py-2.5 font-bold">Cliente / Producto</th>
                    <th className="text-right px-4 py-2.5 font-bold">Base cobrada</th>
                    <th className="text-right px-4 py-2.5 font-bold">%</th>
                    <th className="text-right px-4 py-2.5 font-bold">Comision</th>
                    <th className="text-left px-4 py-2.5 font-bold">Estado</th>
                    {isAdmin && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      {isAdmin && <td className="px-4 py-3 font-semibold">{r.user_nombre}</td>}
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.lead_nombre}</div>
                        <div className="text-xs text-muted-foreground">{r.product_nombre || r.producto_contratado || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.importe_base)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.pct}%</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{fmt(r.importe_comision)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.estado === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                          r.estado === 'cancelado' ? 'bg-muted text-muted-foreground' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                        }`}>{r.estado}</span>
                        {r.fecha_pago && <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(r.fecha_pago)}</p>}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {r.estado === 'pendiente' && Number(r.importe_comision) > 0 && (
                            <button onClick={() => handlePay(r.id)} className="px-2 py-1 rounded bg-green-50 text-green-600 text-[11px] font-semibold hover:bg-green-100">
                              Pagar
                            </button>
                          )}
                        </td>
                      )}
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
                      <div className="font-semibold truncate">{r.lead_nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.product_nombre || r.producto_contratado || '—'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      r.estado === 'pagado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      r.estado === 'cancelado' ? 'bg-muted text-muted-foreground' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                    }`}>{r.estado}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Base</div>
                      <div className="tabular-nums">{fmt(r.importe_base)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">%</div>
                      <div className="tabular-nums">{r.pct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Comision</div>
                      <div className="tabular-nums font-semibold">{fmt(r.importe_comision)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="text-muted-foreground">
                      {formatDate(r.created_at)}
                      {isAdmin && r.user_nombre && <span> · <span className="font-medium text-foreground">{r.user_nombre}</span></span>}
                    </div>
                    {isAdmin && r.estado === 'pendiente' && Number(r.importe_comision) > 0 && (
                      <button onClick={() => handlePay(r.id)} className="px-2 py-1 rounded bg-green-50 text-green-600 text-[11px] font-semibold hover:bg-green-100 flex-shrink-0">
                        Pagar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {rulesOpen && <RulesDialog onClose={() => setRulesOpen(false)} onSaved={load} />}
    </div>
  );
}

function RulesDialog({ onClose, onSaved }) {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState({ project_id: '', user_id: '', product_id: '', pct: '', base_calc: 'cobrado' });

  async function load() {
    setLoading(true);
    try {
      const [r, u, pj] = await Promise.all([
        commissionsApi.listRules(),
        client.get('/users?active=true'),
        client.get('/projects'),
      ]);
      if (r.success) setRules(r.data || []);
      if (u.success) setUsers((u.data?.users || u.data || []).filter(x => x.role === 'gestor' || x.role === 'admin'));
      if (pj.success) setProjects(pj.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!newRule.project_id) { setProducts([]); return; }
    (async () => {
      try {
        const r = await client.get(`/products/${newRule.project_id}`);
        if (r.success) setProducts(r.data || []);
      } catch {}
    })();
  }, [newRule.project_id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newRule.project_id || !newRule.user_id || newRule.pct === '') return;
    try {
      await commissionsApi.createRule({
        project_id: Number(newRule.project_id),
        user_id: Number(newRule.user_id),
        product_id: newRule.product_id ? Number(newRule.product_id) : null,
        pct: Number(newRule.pct),
        base_calc: newRule.base_calc || 'cobrado',
      });
      toast({ title: 'Regla guardada' });
      setNewRule({ project_id: '', user_id: '', product_id: '', pct: '', base_calc: 'cobrado' });
      await load();
      onSaved?.();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta regla?')) return;
    try {
      await commissionsApi.deleteRule(id);
      await load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function handleEditPct(rule, newPct) {
    try {
      await commissionsApi.updateRule(rule.id, { pct: Number(newPct) });
      await load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card sm:rounded-lg border border-border w-full max-w-3xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Reglas de comision</h2>
              <p className="text-xs text-muted-foreground">% que cobra cada gestor por cada producto/formacion</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
          </div>

          <div className="overflow-y-auto p-6 space-y-5">
            <form onSubmit={handleAdd} className="p-4 bg-muted/30 rounded-md border border-border space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Nueva regla</p>
              <div className="grid grid-cols-4 gap-2">
                <select value={newRule.project_id} onChange={e => setNewRule({ ...newRule, project_id: e.target.value, product_id: '' })} className={inputClass} required>
                  <option value="">Proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <select value={newRule.user_id} onChange={e => setNewRule({ ...newRule, user_id: e.target.value })} className={inputClass} required>
                  <option value="">Gestor</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
                <select value={newRule.product_id} onChange={e => setNewRule({ ...newRule, product_id: e.target.value })} className={inputClass} disabled={!newRule.project_id}>
                  <option value="">Todas las ventas (generica)</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <div className="flex gap-1">
                  <input type="number" min="0" max="100" step="0.01" placeholder="%" value={newRule.pct} onChange={e => setNewRule({ ...newRule, pct: e.target.value })} className={inputClass + ' flex-1'} required />
                  <button type="submit" className="px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 flex items-center gap-1">
                    <Plus size={12} weight="bold" />
                  </button>
                </div>
                <select value={newRule.base_calc} onChange={e => setNewRule({ ...newRule, base_calc: e.target.value })} className={inputClass + ' col-span-4'}>
                  <option value="cobrado">Calcular sobre lo cobrado (cuando cliente paga)</option>
                  <option value="vendido">Calcular sobre lo vendido (al firmar venta)</option>
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground">Si producto vacio = aplica a TODAS las ventas del gestor en ese proyecto. Producto especifico = override.</p>
            </form>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-md">
                <Gear size={32} className="text-muted-foreground/30 mx-auto mb-2" weight="regular" />
                <p className="text-sm font-semibold">Sin reglas configuradas</p>
                <p className="text-xs text-muted-foreground">Crea una regla para empezar a generar comisiones automaticamente</p>
              </div>
            ) : (
              <div className="space-y-1">
                {rules.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-muted/40 rounded-lg group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.user_nombre}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm">{r.product_nombre}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.project_nombre}</span>
                      </div>
                    </div>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      defaultValue={r.pct}
                      onBlur={e => { if (Number(e.target.value) !== Number(r.pct)) handleEditPct(r, e.target.value); }}
                      className="w-20 h-9 px-2 rounded-lg border border-border bg-card text-sm text-right font-bold"
                    />
                    <span className="text-sm font-bold">%</span>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100">
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
