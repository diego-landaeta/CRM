import { useEffect, useState, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Coins, Plus, X, FloppyDisk, Calendar, Clock } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

const TABS = [
  { id: 'plans', label: 'Planes' },
  { id: 'periods', label: 'Periodos' },
  { id: 'hours', label: 'Horas' },
];

export default function PayrollPage() {
  const { activeProject } = useProjectContext();
  const [tab, setTab] = useState('plans');

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Nominas" subtitle={`Plantilla y pagos en ${activeProject?.nombre || 'este proyecto'}`} />
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-bold border-b-2 ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'plans' && <PlansTab project={activeProject} />}
      {tab === 'periods' && <PeriodsTab project={activeProject} />}
      {tab === 'hours' && <HoursTab project={activeProject} />}
    </div>
  );
}

function PlansTab({ project }) {
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [pl, us] = await Promise.all([
        client.get(`/payroll/plans?projectId=${project.id}`),
        client.get(`/users`),
      ]);
      if (pl.success) setPlans(pl.data);
      if (us.success) setUsers(us.data);
    } finally { setLoading(false); }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(p) {
    try {
      await client.put('/payroll/plans', { ...p, project_id: project.id });
      toast({ title: 'Plan guardado' });
      setEditing(null); load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function handleDelete(p) {
    if (!confirm('Eliminar plan?')) return;
    await client.delete(`/payroll/plans/${p.id}`); load();
  }

  const usersWithoutPlan = users.filter(u => !plans.find(p => p.user_id === u.id));

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {usersWithoutPlan.length > 0 && (
          <select onChange={e => { if (e.target.value) setEditing({ user_id: parseInt(e.target.value), modo_fijo: '', modo_horas: '', modo_comisiones: false, active: true }); }} className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
            <option value="">Añadir plan a usuario...</option>
            {usersWithoutPlan.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="text-sm text-muted-foreground p-6">Cargando...</p> : plans.length === 0 ? (
        <EmptyState icon={Coins} title="Sin planes" description="Configura cuanto cobra cada usuario" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
              <th className="text-left px-4 py-2.5 font-bold">Usuario</th>
              <th className="text-right px-4 py-2.5 font-bold">Fijo €/mes</th>
              <th className="text-right px-4 py-2.5 font-bold">€/hora</th>
              <th className="text-center px-4 py-2.5 font-bold">Comisiones</th>
              <th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3"><div className="font-semibold">{p.user_nombre}</div><div className="text-xs text-muted-foreground">{p.user_email}</div></td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.modo_fijo != null ? Number(p.modo_fijo).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.modo_horas != null ? Number(p.modo_horas).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-center">{p.modo_comisiones ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(p)} className="px-2 py-1 rounded bg-muted text-xs font-bold mr-1">Editar</button>
                    <button onClick={() => handleDelete(p)} className="px-2 py-1 rounded text-red-500 hover:bg-red-50 text-xs font-bold">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <PlanEditor plan={editing} users={users} onSave={handleSave} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanEditor({ plan, users, onSave, onClose }) {
  const [p, setP] = useState(plan);
  const usr = users.find(u => u.id === p.user_id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-extrabold">Plan: {usr?.nombre}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">Fijo €/mes (opcional)</span>
            <input type="number" step="0.01" value={p.modo_fijo ?? ''} onChange={e => setP({ ...p, modo_fijo: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">€/hora (opcional)</span>
            <input type="number" step="0.01" value={p.modo_horas ?? ''} onChange={e => setP({ ...p, modo_horas: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!p.modo_comisiones} onChange={e => setP({ ...p, modo_comisiones: e.target.checked })} />
            Cobra comisiones (calculadas en modulo de comisiones)
          </label>
          {p.modo_fijo != null && p.modo_horas != null && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">Combinacion fijo+horas es poco comun, asegurate de que es lo que quieres</p>
          )}
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">Notas</span>
            <textarea value={p.notas || ''} onChange={e => setP({ ...p, notas: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm" />
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold">Cancelar</button>
            <button onClick={() => onSave(p)} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"><FloppyDisk size={14} weight="bold" /> Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodsTab({ project }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        client.get(`/payroll/periods?projectId=${project.id}&year=${year}&month=${month}`),
        client.get(`/payroll/plans?projectId=${project.id}`),
      ]);
      if (p.success) setPeriods(p.data);
      if (u.success) setUsers(u.data);
    } finally { setLoading(false); }
  }, [project?.id, year, month]);

  useEffect(() => { load(); }, [load]);

  async function generateAll() {
    for (const u of users) {
      try { await client.post('/payroll/periods/generate', { project_id: project.id, user_id: u.user_id, year, month }); }
      catch (err) { console.warn('Skip', u.user_nombre, err?.data?.error); }
    }
    toast({ title: 'Periodos generados' });
    load();
  }
  async function close(p) { await client.post(`/payroll/periods/${p.id}/close`); load(); }
  async function pay(p) { await client.post(`/payroll/periods/${p.id}/pay`, { fecha_pago: new Date().toISOString().slice(0, 10) }); load(); }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 w-24 px-2 rounded border border-border bg-card text-sm" />
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 px-3 rounded border border-border bg-card text-sm">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <button onClick={generateAll} className="ml-auto px-3 py-1.5 rounded bg-primary text-white text-xs font-bold">Generar/recalcular periodos</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground p-6">Cargando...</p> : periods.length === 0 ? (
        <EmptyState icon={Calendar} title="Sin periodos" description="Genera los periodos del mes" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
              <th className="text-left px-4 py-2.5 font-bold">Usuario</th>
              <th className="text-right px-4 py-2.5 font-bold">Fijo</th>
              <th className="text-right px-4 py-2.5 font-bold">Horas</th>
              <th className="text-right px-4 py-2.5 font-bold">Comisiones</th>
              <th className="text-right px-4 py-2.5 font-bold">Ajustes</th>
              <th className="text-right px-4 py-2.5 font-bold">Total</th>
              <th className="text-center px-4 py-2.5 font-bold">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-semibold">{p.user_nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(p.fijo).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(p.monto_horas).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(p.monto_comisiones).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(p.ajustes).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{Number(p.total).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.estado === 'pagado' ? 'bg-emerald-100 text-emerald-700' : p.estado === 'cerrado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{p.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.estado === 'abierto' && <button onClick={() => close(p)} className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold mr-1">Cerrar</button>}
                    {p.estado === 'cerrado' && <button onClick={() => pay(p)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold">Pagar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HoursTab({ project }) {
  const [hours, setHours] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ user_id: '', fecha: new Date().toISOString().slice(0, 10), horas: '', notas: '' });

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [h, p] = await Promise.all([
        client.get(`/payroll/hours?projectId=${project.id}`),
        client.get(`/payroll/plans?projectId=${project.id}`),
      ]);
      if (h.success) setHours(h.data);
      if (p.success) setUsers(p.data.filter(x => x.modo_horas != null));
    } finally { setLoading(false); }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.user_id || !form.horas) { toast({ title: 'Usuario y horas requeridos', variant: 'destructive' }); return; }
    try {
      await client.post('/payroll/hours', { project_id: project.id, user_id: parseInt(form.user_id), fecha: form.fecha, horas: parseFloat(form.horas), notas: form.notas });
      toast({ title: 'Registrado' });
      setForm({ user_id: '', fecha: new Date().toISOString().slice(0, 10), horas: '', notas: '' });
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function del(h) { await client.delete(`/payroll/hours/${h.id}`); load(); }

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className="h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm">
          <option value="">Usuario</option>
          {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_nombre}</option>)}
        </select>
        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
        <input type="number" step="0.25" placeholder="Horas" value={form.horas} onChange={e => setForm({ ...form, horas: e.target.value })} className="h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
        <input placeholder="Notas" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className="h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm md:col-span-1" />
        <button onClick={add} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold flex items-center justify-center gap-1"><Plus size={14} weight="bold" /> Registrar</button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground p-6">Cargando...</p> : hours.length === 0 ? (
        <EmptyState icon={Clock} title="Sin horas registradas" description="Registra horas trabajadas para los usuarios con plan por hora" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
              <th className="text-left px-4 py-2.5 font-bold">Fecha</th>
              <th className="text-left px-4 py-2.5 font-bold">Usuario</th>
              <th className="text-right px-4 py-2.5 font-bold">Horas</th>
              <th className="text-left px-4 py-2.5 font-bold">Notas</th>
              <th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {hours.map(h => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{h.fecha}</td>
                  <td className="px-4 py-3 font-semibold">{h.user_nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(h.horas).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{h.notas || ''}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => del(h)} className="px-2 py-1 rounded text-red-500 hover:bg-red-50 text-xs font-bold">Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
