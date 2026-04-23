import { useEffect, useState } from 'react';
import { accountingApi } from '../api/accounting.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import Portal from '@/shared/components/ui/portal';
import { Plus, X, Receipt, Trash, PencilSimple } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

const CATEGORIAS = ['salarios', 'alquiler', 'proveedores', 'software', 'publicidad', 'impuestos', 'servicios', 'mantenimiento', 'otros'];
const CAT_COLORS = {
  salarios: 'bg-blue-100 text-blue-800',
  alquiler: 'bg-purple-100 text-purple-800',
  proveedores: 'bg-amber-100 text-amber-800',
  software: 'bg-emerald-100 text-emerald-800',
  publicidad: 'bg-pink-100 text-pink-800',
  impuestos: 'bg-red-100 text-red-800',
  servicios: 'bg-cyan-100 text-cyan-800',
  mantenimiento: 'bg-orange-100 text-orange-800',
  otros: 'bg-gray-100 text-gray-800',
};

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
}
function formatDate(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExpensesPage() {
  const { activeProject } = useProjectContext();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (activeProject?.id) params.projectId = activeProject.id;
      if (filterCat) params.categoria = filterCat;
      const res = await accountingApi.listExpenses(params);
      if (res.success) setExpenses(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeProject?.id, filterCat]);

  async function handleDelete(id) {
    if (!confirm('Eliminar este egreso?')) return;
    try {
      await accountingApi.deleteExpense(id);
      toast({ title: 'Egreso eliminado' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  const total = expenses.reduce((s, e) => s + Number(e.importe), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Egresos"
        subtitle={`${expenses.length} registros • Total: ${fmt(total)}`}
        actions={
          <button onClick={() => { setEditing(null); setDialogOpen(true); }} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
            <Plus size={14} weight="bold" /> Nuevo egreso
          </button>
        }
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
          <option value="">Todas las categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}</div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin egresos" description="No hay gastos registrados" action={<button onClick={() => setDialogOpen(true)} className="text-sm text-primary hover:underline">Crear el primero</button>} />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-bold">Fecha</th>
                <th className="text-left px-5 py-2.5 font-bold">Concepto</th>
                <th className="text-left px-5 py-2.5 font-bold">Categoria</th>
                <th className="text-left px-5 py-2.5 font-bold">Proyecto</th>
                <th className="text-right px-5 py-2.5 font-bold">Importe</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3">{formatDate(e.fecha)}</td>
                  <td className="px-5 py-3 font-semibold">
                    {e.concepto}
                    {e.notas && <div className="text-xs text-muted-foreground font-normal mt-0.5">{e.notas}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${CAT_COLORS[e.categoria] || CAT_COLORS.otros}`}>
                      {e.categoria}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{e.proyecto_nombre || <span className="italic">General</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-bold">{fmt(e.importe)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => { setEditing(e); setDialogOpen(true); }} className="p-1 rounded hover:bg-muted">
                        <PencilSimple size={14} weight="bold" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        expense={editing}
        activeProjectId={activeProject?.id}
        onSaved={() => load()}
      />
    </div>
  );
}

function ExpenseDialog({ open, onClose, expense, activeProjectId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    concepto: '',
    importe: '',
    categoria: 'otros',
    fecha: new Date().toISOString().slice(0, 10),
    project_id: activeProjectId || null,
    notas: '',
  });

  useEffect(() => {
    if (open) {
      if (expense) {
        setForm({
          concepto: expense.concepto,
          importe: String(expense.importe),
          categoria: expense.categoria,
          fecha: String(expense.fecha).slice(0, 10),
          project_id: expense.project_id,
          notas: expense.notas || '',
        });
      } else {
        setForm({
          concepto: '',
          importe: '',
          categoria: 'otros',
          fecha: new Date().toISOString().slice(0, 10),
          project_id: activeProjectId || null,
          notas: '',
        });
      }
    }
  }, [open, expense, activeProjectId]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.concepto || !form.importe) return;
    setSaving(true);
    try {
      const payload = {
        concepto: form.concepto,
        importe: Number(form.importe),
        categoria: form.categoria,
        fecha: form.fecha,
        project_id: form.project_id || null,
        notas: form.notas || null,
      };
      if (expense) {
        await accountingApi.updateExpense(expense.id, payload);
        toast({ title: 'Egreso actualizado' });
      } else {
        await accountingApi.createExpense(payload);
        toast({ title: 'Egreso registrado', description: fmt(payload.importe) });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Portal>
      <div role="dialog" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{expense ? 'Editar egreso' : 'Nuevo egreso'}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} weight="bold" /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Concepto *</label>
              <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Alquiler oficina, salarios enero..." className={inputClass} required autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Importe (EUR) *</label>
                <input type="number" step="0.01" min="0.01" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Categoria</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className={inputClass + ' appearance-none cursor-pointer pr-8'}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Notas</label>
              <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm outline-none resize-none focus:border-primary" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">{saving ? 'Guardando...' : (expense ? 'Guardar' : 'Crear egreso')}</button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
