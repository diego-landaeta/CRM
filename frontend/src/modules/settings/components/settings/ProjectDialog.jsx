import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';

const inputClass = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function ProjectDialog({ open, onClose, existing, onSaved }) {
  const [form, setForm] = useState({
    nombre: '', slug: '', type: 'crm', dias_alerta_inactividad: 3,
    meta_account_id: '', google_account_id: '', gsc_property: '', emoji: '', active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          nombre: existing.nombre || '',
          slug: existing.slug || '',
          type: existing.type || 'crm',
          dias_alerta_inactividad: existing.dias_alerta_inactividad || 3,
          meta_account_id: existing.meta_account_id || '',
          google_account_id: existing.google_account_id || '',
          gsc_property: existing.gsc_property || '',
          emoji: existing.emoji || '',
          active: existing.active !== false,
          producto_label: existing.producto_label || 'Producto',
          producto_label_plural: existing.producto_label_plural || 'Productos',
        });
      } else {
        setForm({
          nombre: '', slug: '', type: 'crm', dias_alerta_inactividad: 3,
          meta_account_id: '', google_account_id: '', gsc_property: '',
          emoji: '', active: true,
          producto_label: 'Producto', producto_label_plural: 'Productos',
        });
      }
    }
  }, [open, existing]);

  if (!open) return null;

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nombre?.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' });
      return;
    }
    if (!existing && !form.slug?.trim()) {
      toast({ title: 'Slug requerido', description: 'Identificador único del proyecto.', variant: 'destructive' });
      return;
    }
    if (!existing && !/^[a-z0-9-]+$/.test(form.slug.trim())) {
      toast({ title: 'Slug inválido', description: 'Solo minúsculas, números y guiones.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        type: form.type,
        dias_alerta_inactividad: Number(form.dias_alerta_inactividad),
        emoji: form.emoji || null,
        meta_account_id: form.meta_account_id || null,
        google_account_id: form.google_account_id || null,
        gsc_property: form.gsc_property || null,
        producto_label: form.producto_label || 'Producto',
        producto_label_plural: form.producto_label_plural || 'Productos',
      };
      if (existing) {
        payload.active = form.active;
        await client.patch(`/projects/${existing.id}`, payload);
        toast({ title: 'Proyecto actualizado' });
      } else {
        payload.slug = form.slug;
        await client.post('/projects', payload);
        toast({ title: 'Proyecto creado' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-lg border border-border w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{existing ? 'Editar' : 'Nuevo'} proyecto</h2>
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Slug *</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className={inputClass + ' font-mono'} disabled={!!existing} placeholder="psiko-aprende" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputClass}>
                  <option value="crm">CRM (leads)</option>
                  <option value="ia">IA (monitor pagos)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Alerta inactividad (dias)</label>
                <input type="number" min="1" max="365" value={form.dias_alerta_inactividad} onChange={e => setForm({ ...form, dias_alerta_inactividad: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              <div className="col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Etiqueta de producto</p>
                <p className="text-[11px] text-muted-foreground">Personaliza como se llama &quot;Producto&quot; en este proyecto (ej: Formacion, Plan, Servicio)</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Singular</label>
                <input value={form.producto_label} onChange={e => setForm({ ...form, producto_label: e.target.value })} className={inputClass} placeholder="Formacion" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Plural</label>
                <input value={form.producto_label_plural} onChange={e => setForm({ ...form, producto_label_plural: e.target.value })} className={inputClass} placeholder="Formaciones" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Meta Account ID (opcional)</label>
              <input value={form.meta_account_id} onChange={e => setForm({ ...form, meta_account_id: e.target.value })} className={inputClass} placeholder="act_1234567890" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Google Ads Account ID (opcional)</label>
              <input value={form.google_account_id} onChange={e => setForm({ ...form, google_account_id: e.target.value })} className={inputClass} placeholder="123-456-7890" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">GSC Property URL (opcional)</label>
              <input value={form.gsc_property} onChange={e => setForm({ ...form, gsc_property: e.target.value })} className={inputClass} placeholder="sc-domain:psikoaprende.com" />
            </div>

            {existing && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Activo
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : (existing ? 'Guardar' : 'Crear proyecto')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
