import { useEffect, useState, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Envelope, Plus, Trash, X, Play, Pause, FloppyDisk } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

const TRIGGERS = [
  { v: 'lead_created', label: 'Cuando se crea un lead' },
  { v: 'status_changed', label: 'Cuando cambia el estado' },
  { v: 'conversion_created', label: 'Cuando se convierte' },
  { v: 'manual', label: 'Manual (lanzar a mano)' },
];

export default function EmailSequencesPage() {
  const { activeProject } = useProjectContext();
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await client.get(`/email-sequences?projectId=${activeProject.id}`);
      if (res.success) setSequences(res.data);
    } finally { setLoading(false); }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(seq) {
    try {
      if (seq.id) await client.patch(`/email-sequences/${seq.id}`, seq);
      else await client.post('/email-sequences', { ...seq, project_id: activeProject.id });
      toast({ title: 'Guardado' });
      setEditing(null);
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function handleToggle(s) {
    try { await client.patch(`/email-sequences/${s.id}`, { active: !s.active }); load(); }
    catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function handleDelete(s) {
    if (!confirm('Eliminar secuencia?')) return;
    await client.delete(`/email-sequences/${s.id}`);
    load();
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Secuencias de email"
        subtitle={`${sequences.length} secuencias en ${activeProject?.nombre || 'este proyecto'}`}
        actions={
          <button onClick={() => setEditing({ nombre: '', trigger_event: 'lead_created', trigger_filter: {}, steps: [{ delay_hours: 0, subject: '', body: '' }], active: true })} className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">
            <Plus size={14} weight="bold" /> Nueva secuencia
          </button>
        }
      />

      {loading ? <div className="text-center py-8 text-sm text-muted-foreground">Cargando...</div> :
        sequences.length === 0 ? (
          <EmptyState icon={Envelope} title="Sin secuencias" description="Crea una para enviar emails de seguimiento automaticos" />
        ) : (
          <div className="grid gap-3">
            {sequences.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{s.nombre}</h3>
                    {!s.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-bold">PAUSADA</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{TRIGGERS.find(t => t.v === s.trigger_event)?.label || s.trigger_event} · {s.steps?.length || 0} pasos · {s.active_runs || 0} activas, {s.completed_runs || 0} completadas</p>
                </div>
                <button onClick={() => handleToggle(s)} className="p-2 rounded hover:bg-muted" title={s.active ? 'Pausar' : 'Reanudar'}>
                  {s.active ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button onClick={() => setEditing(s)} className="px-3 py-1.5 rounded bg-muted text-xs font-bold">Editar</button>
                <button onClick={() => handleDelete(s)} className="p-2 rounded hover:bg-red-50 text-red-500"><Trash size={14} /></button>
              </div>
            ))}
          </div>
        )}

      {editing && <SequenceEditor seq={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SequenceEditor({ seq, onSave, onClose }) {
  const [s, setS] = useState({ ...seq, steps: seq.steps?.length ? seq.steps : [{ delay_hours: 0, subject: '', body: '' }] });

  function updateStep(i, field, value) {
    const next = [...s.steps];
    next[i] = { ...next[i], [field]: value };
    setS({ ...s, steps: next });
  }
  function addStep() { setS({ ...s, steps: [...s.steps, { delay_hours: 24, subject: '', body: '' }] }); }
  function removeStep(i) { setS({ ...s, steps: s.steps.filter((_, idx) => idx !== i) }); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-extrabold">{s.id ? 'Editar' : 'Nueva'} secuencia</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <input value={s.nombre} onChange={e => setS({ ...s, nombre: e.target.value })} placeholder="Nombre de la secuencia" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
          <select value={s.trigger_event} onChange={e => setS({ ...s, trigger_event: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm">
            {TRIGGERS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-bold uppercase text-muted-foreground">Pasos</p>
            {s.steps.map((step, i) => (
              <div key={i} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Paso {i + 1}</span>
                  <input type="number" min="0" value={step.delay_hours} onChange={e => updateStep(i, 'delay_hours', Number(e.target.value))} className="w-20 h-8 px-2 rounded border border-border bg-card text-xs" />
                  <span className="text-xs text-muted-foreground">horas tras anterior</span>
                  {s.steps.length > 1 && <button onClick={() => removeStep(i)} className="ml-auto p-1 rounded hover:bg-red-50 text-red-500"><Trash size={12} /></button>}
                </div>
                <input value={step.subject || ''} onChange={e => updateStep(i, 'subject', e.target.value)} placeholder="Asunto" className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
                <textarea value={step.body || ''} onChange={e => updateStep(i, 'body', e.target.value)} placeholder="Cuerpo HTML del email" rows={3} className="w-full px-2 py-1.5 rounded border border-border bg-card text-xs font-mono" />
              </div>
            ))}
            <button onClick={addStep} className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-xs font-bold"><Plus size={12} /> Añadir paso</button>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold">Cancelar</button>
            <button onClick={() => onSave(s)} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"><FloppyDisk size={14} weight="bold" /> Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
