import { useState, useEffect, useCallback } from 'react';
import {
  X, Gear, FolderOpen, Notepad, PlugsConnected, Key, ArrowUp, ArrowDown, FloppyDisk,
  Plus, Copy, CheckCircle, Eye, EyeSlash, ArrowsClockwise, Tag,
} from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';

const TABS = [
  { id: 'general', label: 'General', icon: Gear },
  { id: 'categorias', label: 'Categorias', icon: FolderOpen },
  { id: 'campos', label: 'Campos', icon: Notepad },
  { id: 'webhook', label: 'Webhook', icon: PlugsConnected },
  { id: 'apis', label: 'APIs', icon: Key },
];

const inputClass = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function ProjectSettingsDialog({ project, onClose, onSaved }) {
  const [tab, setTab] = useState('general');

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                {project.emoji || '📁'}
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Configurar {project.nombre}</h2>
                <p className="text-xs text-muted-foreground">{project.slug} &mdash; {project.type === 'crm' ? 'Proyecto CRM' : 'Proyecto IA'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <div className="flex flex-1 min-h-0">
            <nav className="w-52 border-r border-border p-3 space-y-1 bg-muted/20 flex-shrink-0">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    tab === t.id
                      ? 'bg-primary text-white font-bold shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <t.icon size={16} weight={tab === t.id ? 'fill' : 'regular'} />
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'general' && <GeneralTab project={project} onSaved={onSaved} />}
              {tab === 'categorias' && <CategoriesTab project={project} />}
              {tab === 'campos' && <FieldsTab project={project} />}
              {tab === 'webhook' && <WebhookTab project={project} />}
              {tab === 'apis' && <ApisTab project={project} />}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ============================================================
// GENERAL
// ============================================================
function GeneralTab({ project, onSaved }) {
  const [form, setForm] = useState({
    nombre: project.nombre,
    type: project.type || 'crm',
    dias_alerta_inactividad: project.dias_alerta_inactividad || 3,
    emoji: project.emoji || '',
    meta_account_id: project.meta_account_id || '',
    google_account_id: project.google_account_id || '',
    gsc_property: project.gsc_property || '',
    active: project.active !== false,
    producto_label: project.producto_label || 'Producto',
    producto_label_plural: project.producto_label_plural || 'Productos',
  });
  const [saving, setSaving] = useState(false);
  const [logoVersion, setLogoVersion] = useState(Date.now());
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const hasLogo = !!project.logo_key;

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Maximo 5 MB', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await client.post(`/projects/${project.id}/logo`, fd);
      if (res.success) {
        toast({ title: 'Logo actualizado' });
        setLogoVersion(Date.now());
        onSaved?.();
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  }

  async function handleLogoDelete() {
    if (!confirm('Eliminar el logo?')) return;
    try {
      await client.delete(`/projects/${project.id}/logo`);
      toast({ title: 'Logo eliminado' });
      setLogoVersion(Date.now());
      onSaved?.();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  const baseUrl = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
  const logoSrc = hasLogo ? `${baseUrl}/api/projects/${project.id}/logo?v=${logoVersion}` : null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.patch(`/projects/${project.id}`, {
        nombre: form.nombre,
        type: form.type,
        dias_alerta_inactividad: Number(form.dias_alerta_inactividad),
        emoji: form.emoji || null,
        meta_account_id: form.meta_account_id || null,
        google_account_id: form.google_account_id || null,
        gsc_property: form.gsc_property || null,
        active: form.active,
        producto_label: form.producto_label || 'Producto',
        producto_label_plural: form.producto_label_plural || 'Productos',
      });
      toast({ title: 'Cambios guardados' });
      onSaved?.();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      <SectionTitle title="Logo del proyecto" subtitle="PNG, JPG, WEBP o SVG. Max 5 MB. Se usa en el sidebar y dashboard." />
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-xl border border-border">
        <div className="w-20 h-20 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-3xl">{form.emoji || '📁'}</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
              {uploadingLogo ? 'Subiendo...' : hasLogo ? 'Cambiar logo' : 'Subir logo'}
            </label>
            {hasLogo && (
              <button type="button" onClick={handleLogoDelete} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">
                Eliminar
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Si no hay logo se muestra el emoji. El logo tiene prioridad.</p>
        </div>
      </div>

      <SectionTitle title="Informacion basica" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre *">
          <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputClass} required />
        </Field>
        <Field label="Emoji de respaldo" hint="Se muestra si no hay logo">
          <input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} className={inputClass} placeholder="🎓" maxLength={4} />
        </Field>
        <Field label="Tipo">
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputClass}>
            <option value="crm">CRM (leads)</option>
            <option value="ia">IA (monitor pagos)</option>
          </select>
        </Field>
        <Field label="Alerta inactividad" hint="Dias sin contacto para avisar">
          <input type="number" min="1" max="365" value={form.dias_alerta_inactividad} onChange={e => setForm({ ...form, dias_alerta_inactividad: e.target.value })} className={inputClass} />
        </Field>
      </div>

      <SectionTitle title="Terminologia del proyecto" subtitle="Como se llaman &quot;productos&quot; aqui (ej Formacion, Plan, Servicio)" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Producto singular">
          <input value={form.producto_label} onChange={e => setForm({ ...form, producto_label: e.target.value })} className={inputClass} placeholder="Formacion" />
        </Field>
        <Field label="Producto plural">
          <input value={form.producto_label_plural} onChange={e => setForm({ ...form, producto_label_plural: e.target.value })} className={inputClass} placeholder="Formaciones" />
        </Field>
      </div>

      <SectionTitle title="Integraciones publicitarias" subtitle="Opcional; configura si el proyecto usa Meta/Google/GSC" />
      <div className="grid grid-cols-1 gap-3">
        <Field label="Meta Account ID">
          <input value={form.meta_account_id} onChange={e => setForm({ ...form, meta_account_id: e.target.value })} className={inputClass} placeholder="act_123456" />
        </Field>
        <Field label="Google Ads Account ID">
          <input value={form.google_account_id} onChange={e => setForm({ ...form, google_account_id: e.target.value })} className={inputClass} />
        </Field>
        <Field label="GSC Property URL">
          <input value={form.gsc_property} onChange={e => setForm({ ...form, gsc_property: e.target.value })} className={inputClass} placeholder="sc-domain:ejemplo.com" />
        </Field>
      </div>

      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
        <div>
          <p className="font-semibold text-sm">Proyecto activo</p>
          <p className="text-xs text-muted-foreground">Desactivar oculta el proyecto del selector</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="sr-only peer" />
          <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// CATEGORIAS
// ============================================================
function CategoriesTab({ project }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState({ nombre: '', parent_id: '' });
  const productoLabel = project.producto_label_plural?.toLowerCase() || 'productos';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/product-categories/project/${project.id}`);
      if (res.success) setCats(res.data || []);
    } finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newCat.nombre.trim()) return;
    try {
      await client.post('/product-categories', {
        project_id: project.id,
        parent_id: newCat.parent_id ? Number(newCat.parent_id) : null,
        nombre: newCat.nombre.trim(),
        orden: cats.length,
      });
      toast({ title: 'Categoria creada' });
      setNewCat({ nombre: '', parent_id: '' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta categoria? Los productos quedan sin categoria pero no se borran.')) return;
    try {
      await client.delete(`/product-categories/${id}`);
      await load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  const parents = cats.filter(c => !c.parent_id);
  const childrenByParent = cats.reduce((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <SectionTitle title="Categorias y subcategorias" subtitle={`Organiza ${productoLabel} en grupos (ej: Cursos, Presenciales, Talleres)`} />
      </div>

      <form onSubmit={handleAdd} className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Añadir categoria</p>
        <div className="flex gap-2">
          <input
            value={newCat.nombre}
            onChange={e => setNewCat({ ...newCat, nombre: e.target.value })}
            placeholder="Nombre"
            className={inputClass + ' flex-1'}
            required
          />
          <select
            value={newCat.parent_id}
            onChange={e => setNewCat({ ...newCat, parent_id: e.target.value })}
            className={inputClass + ' flex-1'}
          >
            <option value="">Categoria raiz</option>
            {parents.map(p => <option key={p.id} value={p.id}>Subcategoria de: {p.nombre}</option>)}
          </select>
          <button type="submit" className="px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center gap-1">
            <Plus size={14} weight="bold" /> Añadir
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : parents.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
          <Tag size={32} className="text-muted-foreground/30 mx-auto mb-2" weight="duotone" />
          <p className="text-sm font-semibold">Sin categorias</p>
          <p className="text-xs text-muted-foreground mt-1">Crea una categoria para empezar a organizar tus {productoLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {parents.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-primary" weight="fill" />
                  <span className="font-bold text-sm">{p.nombre}</span>
                  {childrenByParent[p.id]?.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {childrenByParent[p.id].length} subcategoria{childrenByParent[p.id].length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button onClick={() => handleDelete(p.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><X size={14} /></button>
              </div>
              {childrenByParent[p.id]?.length > 0 && (
                <div className="mt-2 ml-5 space-y-1 border-l border-border pl-3">
                  {childrenByParent[p.id].map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>— {c.nombre}</span>
                      <button onClick={() => handleDelete(c.id)} className="p-0.5 rounded hover:bg-red-50 text-red-500"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CAMPOS CUSTOM
// ============================================================
const FIELD_TYPES = [
  { v: 'text', label: 'Texto corto' },
  { v: 'textarea', label: 'Texto largo' },
  { v: 'number', label: 'Numero' },
  { v: 'date', label: 'Fecha' },
  { v: 'select', label: 'Seleccion' },
  { v: 'boolean', label: 'Si/No' },
];

function FieldsTab({ project }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('editor');
  const [editingId, setEditingId] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [newField, setNewField] = useState({ field_key: '', label: '', type: 'text', required: false, grupo: '', options: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/field-definitions/project/${project.id}`);
      if (res.success) setFields(res.data);
    } finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newField.field_key || !newField.label) return;
    try {
      const payload = {
        project_id: project.id,
        field_key: newField.field_key,
        label: newField.label,
        type: newField.type,
        required: newField.required,
        orden: fields.length,
        grupo: newField.grupo || null,
      };
      if (newField.type === 'select' && newField.options) {
        payload.options = newField.options.split(',').map(s => s.trim()).filter(Boolean);
      }
      await client.post('/field-definitions', payload);
      toast({ title: 'Campo agregado' });
      setNewField({ field_key: '', label: '', type: 'text', required: false, grupo: '', options: '' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este campo?')) return;
    try { await client.delete(`/field-definitions/${id}`); await load(); }
    catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function handleMove(idx, dir) {
    const next = [...fields];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setFields(next);
    try {
      await client.post('/field-definitions/reorder', {
        project_id: project.id,
        order: next.map((f, i) => ({ id: f.id, orden: i })),
      });
    } catch { await load(); }
  }

  function startEdit(f) {
    setEditingId(f.id);
    setEditBuf({ label: f.label, required: f.required, grupo: f.grupo || '', options: Array.isArray(f.options) ? f.options.join(', ') : '' });
  }

  async function saveEdit(f) {
    try {
      const payload = { label: editBuf.label, required: editBuf.required, grupo: editBuf.grupo || null };
      if (f.type === 'select' && editBuf.options !== undefined) {
        payload.options = editBuf.options.split(',').map(s => s.trim()).filter(Boolean);
      }
      await client.patch(`/field-definitions/${f.id}`, payload);
      setEditingId(null);
      await load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  const smallInput = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary';
  const groups = fields.reduce((acc, f) => {
    const g = f.grupo || 'General';
    (acc[g] = acc[g] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <SectionTitle title="Campos personalizados" subtitle={`${fields.length} campos. Hasta ~15 recomendados.`} />
        </div>
        <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
          <button onClick={() => setView('editor')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === 'editor' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Editor</button>
          <button onClick={() => setView('preview')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === 'preview' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Vista previa</button>
        </div>
      </div>

      {view === 'editor' ? (
        <>
          <form onSubmit={handleAdd} className="p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-3">Nuevo campo</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={newField.field_key} onChange={e => setNewField({ ...newField, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="clave_snake_case" className={smallInput + ' font-mono text-xs'} required />
              <input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} placeholder="Etiqueta visible" className={smallInput} required />
              <select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })} className={smallInput}>
                {FIELD_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <input value={newField.grupo} onChange={e => setNewField({ ...newField, grupo: e.target.value })} placeholder="Seccion (opcional)" className={smallInput} />
              {newField.type === 'select' && (
                <input value={newField.options} onChange={e => setNewField({ ...newField, options: e.target.value })} placeholder="Opciones separadas por coma" className={smallInput + ' col-span-2'} />
              )}
              <div className="col-span-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={newField.required} onChange={e => setNewField({ ...newField, required: e.target.checked })} />
                  Campo requerido
                </label>
                <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">
                  <Plus size={14} weight="bold" /> Agregar
                </button>
              </div>
            </div>
          </form>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : fields.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
              <Notepad size={32} className="text-muted-foreground/30 mx-auto mb-2" weight="duotone" />
              <p className="text-sm font-semibold">Sin campos custom</p>
              <p className="text-xs text-muted-foreground mt-1">Los leads solo tendran los campos base (nombre, email, telefono)</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {fields.map((f, idx) => {
                const isEditing = editingId === f.id;
                return (
                  <div key={f.id} className="group flex items-start gap-2 p-3 bg-muted/20 hover:bg-muted/40 rounded-lg border border-border">
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20" title="Subir"><ArrowUp size={12} /></button>
                      <button onClick={() => handleMove(idx, 1)} disabled={idx === fields.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20" title="Bajar"><ArrowDown size={12} /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editBuf.label} onChange={e => setEditBuf({ ...editBuf, label: e.target.value })} className={smallInput + ' h-8'} />
                          <input value={editBuf.grupo} onChange={e => setEditBuf({ ...editBuf, grupo: e.target.value })} className={smallInput + ' h-8'} placeholder="Seccion" />
                          {f.type === 'select' && (
                            <input value={editBuf.options} onChange={e => setEditBuf({ ...editBuf, options: e.target.value })} className={smallInput + ' h-8 col-span-2'} placeholder="opciones,separadas" />
                          )}
                          <label className="flex items-center gap-1.5 text-xs col-span-2">
                            <input type="checkbox" checked={editBuf.required} onChange={e => setEditBuf({ ...editBuf, required: e.target.checked })} />
                            Requerido
                          </label>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{f.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{f.field_key}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary">{FIELD_TYPES.find(t => t.v === f.type)?.label || f.type}</span>
                            {f.required && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">REQ</span>}
                            {f.grupo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">{f.grupo}</span>}
                          </div>
                          {Array.isArray(f.options) && f.options.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">Opciones: {f.options.join(', ')}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(f)} className="p-1.5 rounded hover:bg-green-50 text-green-600"><FloppyDisk size={14} weight="bold" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-muted"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(f)} className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100"><Gear size={14} /></button>
                          <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100"><X size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Asi se veran los campos al crear/editar un lead:</p>
          {Object.keys(groups).length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">Sin campos</div>
          ) : Object.entries(groups).map(([grupo, items]) => (
            <div key={grupo} className="bg-muted/20 rounded-xl p-4 border border-border">
              <p className="text-[11px] font-bold uppercase text-muted-foreground mb-3">{grupo}</p>
              <div className="grid grid-cols-2 gap-3">
                {items.map(f => (
                  <div key={f.id} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="text-xs font-semibold mb-1 block">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input disabled type={f.type === 'number' ? 'number' : 'text'} className={smallInput} placeholder={`(${f.field_key})`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// WEBHOOK
// ============================================================
function WebhookTab({ project }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(null);
  const baseUrl = window.location.origin + (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '') + '/api';
  const url = `${baseUrl}/leads/webhooks/${project.slug}`;
  const apiKey = project.webhook_api_key;

  async function doCopy(text, key) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch {}
  }

  async function regenerate() {
    if (!confirm('Regenerar API Key? La clave anterior dejara de funcionar de inmediato.')) return;
    try {
      const res = await client.post(`/projects/${project.id}/regenerate-webhook-key`);
      if (res.success) {
        toast({ title: 'Clave regenerada', description: 'Actualiza las integraciones con la nueva clave' });
        location.reload();
      }
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionTitle title="Webhook de leads" subtitle="Endpoint HTTP para recibir leads desde formularios externos" />

      <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">URL del webhook</label>
          <div className="flex gap-2">
            <input readOnly value={url} className={inputClass + ' font-mono text-xs'} />
            <button onClick={() => doCopy(url, 'url')} className="h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted flex items-center gap-1">
              {copied === 'url' ? <CheckCircle size={12} weight="bold" className="text-green-600" /> : <Copy size={12} />} Copiar
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">API Key</label>
          <div className="flex gap-2">
            <input readOnly value={revealed ? apiKey : '•'.repeat(Math.min(40, (apiKey || '').length))} className={inputClass + ' font-mono text-xs'} />
            <button onClick={() => setRevealed(!revealed)} className="h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted">
              {revealed ? <EyeSlash size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => doCopy(apiKey, 'key')} className="h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted flex items-center gap-1">
              {copied === 'key' ? <CheckCircle size={12} weight="bold" className="text-green-600" /> : <Copy size={12} />} Copiar
            </button>
            <button onClick={regenerate} className="h-10 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 flex items-center gap-1">
              <ArrowsClockwise size={14} weight="bold" /> Regenerar
            </button>
          </div>
        </div>
      </div>

      <SectionTitle title="Como usar el webhook" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="font-bold mb-1">1. Campos aceptados</p>
          <p className="text-muted-foreground"><code className="font-mono text-[11px]">nombre, email, telefono, canal, utm_source, utm_campaign, producto_interes</code></p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="font-bold mb-1">2. Autenticacion</p>
          <p className="text-muted-foreground">Header <code className="font-mono text-[11px]">X-API-Key</code> o <code className="font-mono text-[11px]">Authorization: Bearer</code></p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="font-bold mb-1">3. Asignacion automatica</p>
          <p className="text-muted-foreground">Round-robin entre gestores activos del proyecto</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="font-bold mb-1">4. Notificacion</p>
          <p className="text-muted-foreground">Email automatico via Brevo al gestor asignado (no bloquea la respuesta)</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APIS (por proyecto)
// ============================================================
const PROJECT_SERVICES = [
  { service: 'brevo', name: 'Brevo (Email)', description: 'API Key para emails transaccionales de este proyecto', placeholder: 'xkeysib-...' },
  { service: 'meta', name: 'Meta Marketing', description: 'Token + account_id del pixel/cuenta publicitaria', placeholder: 'EAAD...' },
  { service: 'google_ads', name: 'Google Ads', description: 'Developer token + OAuth refresh token', placeholder: 'dev-token' },
  { service: 'gsc', name: 'Google Search Console', description: 'OAuth + property URL', placeholder: 'refresh_token' },
  { service: 'stripe', name: 'Stripe', description: 'Restricted key (solo lectura)', placeholder: 'rk_live_...' },
];

function ApisTab({ project }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogSvc, setDialogSvc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/credentials?projectId=${project.id}`);
      if (res.success) setCredentials(res.data || []);
    } catch (err) {
      if (err.status !== 403) toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  function getCred(service) { return credentials.find(c => c.service === service); }

  async function handleTest(id) {
    try {
      const res = await client.post(`/credentials/${id}/test`);
      toast({ title: 'Test OK', description: res.data?.message });
      await load();
    } catch (err) { toast({ title: 'Test fallo', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta credencial?')) return;
    try { await client.delete(`/credentials/${id}`); await load(); }
    catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <SectionTitle title={`APIs de ${project.nombre}`} subtitle="Credenciales especificas de este proyecto, encriptadas con AES-256-GCM" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {PROJECT_SERVICES.map(svc => {
            const cred = getCred(svc.service);
            return (
              <div key={svc.service} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Key size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{svc.name}</p>
                  <p className="text-[11px] text-muted-foreground">{svc.description}</p>
                  {cred && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{cred.masked_value}</p>}
                </div>
                {cred ? (
                  <>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      cred.last_test_result === 'ok'
                        ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>{cred.last_test_result || 'sin probar'}</span>
                    <button onClick={() => handleTest(cred.id)} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-600 font-semibold">Test</button>
                    <button onClick={() => setDialogSvc(svc)} className="text-[11px] px-2 py-1 rounded border border-border font-semibold">Editar</button>
                    <button onClick={() => handleDelete(cred.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><X size={14} /></button>
                  </>
                ) : (
                  <button onClick={() => setDialogSvc(svc)} className="text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-semibold">Configurar</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dialogSvc && <CredentialQuickDialog project={project} service={dialogSvc} existing={getCred(dialogSvc.service)} onClose={() => setDialogSvc(null)} onSaved={() => { setDialogSvc(null); load(); }} />}
    </div>
  );
}

function CredentialQuickDialog({ project, service, existing, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    try {
      await client.post('/credentials', { project_id: project.id, service: service.service, value });
      toast({ title: 'Guardado' });
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <form onSubmit={handleSave} className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{existing ? 'Editar' : 'Configurar'} {service.name}</h3>
            <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
          </div>
          <p className="text-xs text-muted-foreground">{service.description}</p>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
              {existing ? 'Nuevo valor (si no lo cambias, deja vacio y cancela)' : 'API Key / Token'}
            </label>
            <input
              type="password" required value={value} onChange={e => setValue(e.target.value)}
              placeholder={service.placeholder} autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm font-mono outline-none focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

// ============================================================
// HELPERS UI
// ============================================================
function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5" dangerouslySetInnerHTML={{ __html: subtitle }} />}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
