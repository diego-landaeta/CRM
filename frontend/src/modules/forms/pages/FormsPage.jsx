import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import { Globe, Plus, Trash, Copy, X, FloppyDisk, Code, PlugsConnected, Ear, EarSlash, Users, GraduationCap, Power } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

const KINDS = [
  { v: 'contacto_basico', label: 'Contacto basico (nombre + email + telefono)' },
  { v: 'lead_con_producto', label: 'Lead con producto de interes' },
  { v: 'custom', label: 'Custom (campos manuales)' },
];

const DESTINATIONS = [
  { v: 'lead', label: 'Lead / Prospecto', icon: Users, desc: 'Crea un lead en el embudo (round-robin de gestores)' },
  { v: 'matricula', label: 'Matrícula', icon: GraduationCap, desc: 'Crea una solicitud de admisión en estado pendiente de validación' },
];

export default function FormsPage() {
  const { activeProject } = useProjectContext();
  const [tab, setTab] = useState('form');
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [embedFor, setEmbedFor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await client.get(`/forms?projectId=${activeProject.id}`);
      if (res.success) setForms(res.data);
    } finally { setLoading(false); }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(f) {
    try {
      if (f.id) await client.patch(`/forms/${f.id}`, f);
      else await client.post('/forms', { ...f, project_id: activeProject.id });
      toast({ title: 'Guardado' });
      setEditing(null); load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function handleDelete(f) {
    setDeleteTarget(f);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await client.delete(`/forms/${deleteTarget.id}`);
      toast({ title: 'Eliminado' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function toggleListen(f) {
    try {
      if (f.awaiting_sample) await client.post(`/forms/${f.id}/listen/stop`);
      else await client.post(`/forms/${f.id}/listen`);
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function toggleActive(f) {
    try {
      await client.patch(`/forms/${f.id}`, { active: !f.active });
      toast({ title: f.active ? 'Webhook apagado' : 'Webhook encendido' });
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  const filtered = forms.filter(f => (f.kind || 'form') === tab);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Forms y Webhooks"
        subtitle={`${forms.length} en ${activeProject?.nombre || 'este proyecto'}`}
        actions={
          <button onClick={() => setEditing({ nombre: '', kind: tab, template_kind: 'contacto_basico', config: { color: '#4361ee', button_label: 'Enviar', success_msg: 'Gracias!' }, schema: {}, field_mapping: {}, active: true })} className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">
            <Plus size={14} weight="bold" /> {tab === 'form' ? 'Nuevo form' : 'Nuevo webhook'}
          </button>
        }
      />

      <div className="flex border-b border-border">
        <button onClick={() => setTab('form')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 ${tab === 'form' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          <Globe size={14} /> Forms (UI embebido)
        </button>
        <button onClick={() => setTab('webhook')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 ${tab === 'webhook' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          <PlugsConnected size={14} /> Webhooks (API entrada)
        </button>
      </div>

      {loading ? <SkeletonTable rows={3} columns={3} /> :
        filtered.length === 0 ? (
          <EmptyState icon={tab === 'form' ? Globe : PlugsConnected} title={tab === 'form' ? 'Sin forms' : 'Sin webhooks'} description={tab === 'form' ? 'Crea uno y embebelo en tu landing' : 'Crea un webhook para recibir leads desde sistemas externos'} />
        ) : (
          <div className="grid gap-3">
            {filtered.map(f => {
              const dest = DESTINATIONS.find(d => d.v === (f.destination || 'lead'));
              const DestIcon = dest?.icon || Users;
              return (
              <div key={f.id} className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${!f.active ? 'opacity-60 border-border' : f.awaiting_sample ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/40' : 'border-border'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{f.nombre}</h3>
                    {tab === 'webhook' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                        <DestIcon size={10} weight="bold" /> {dest?.label || f.destination}
                      </span>
                    )}
                    {f.awaiting_sample && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold animate-pulse">● ESCUCHANDO</span>}
                    {!f.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-bold">INACTIVO</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {tab === 'form'
                      ? `${KINDS.find(k => k.v === f.template_kind)?.label} · ${f.submissions_count || 0} submissions`
                      : `${Object.keys(f.field_mapping || {}).length} campos mapeados · ${f.submissions_count || 0} recibidos`}
                    {' · '}<code>{f.embed_id}</code>
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(f)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold ${f.active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                  title={f.active ? 'Apagar webhook (no recibe mas)' : 'Encender webhook'}
                >
                  <Power size={12} weight="bold" /> {f.active ? 'ON' : 'OFF'}
                </button>
                {tab === 'webhook' && f.active && (
                  <button
                    onClick={() => toggleListen(f)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold ${f.awaiting_sample ? 'bg-amber-500 text-white' : 'bg-muted'}`}
                    title={f.awaiting_sample ? 'Apagar escucha (vuelve a procesar)' : 'Esperar payload de prueba para mapear'}
                  >
                    {f.awaiting_sample ? <><EarSlash size={12} weight="bold" /> Escucha OFF</> : <><Ear size={12} weight="bold" /> Escucha ON</>}
                  </button>
                )}
                <button onClick={() => setEmbedFor(f)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-xs font-bold">
                  <Code size={12} /> {tab === 'webhook' ? 'API' : 'Embed'}
                </button>
                <button onClick={() => setEditing(f)} className="px-3 py-1.5 rounded bg-muted text-xs font-bold">Editar</button>
                <button onClick={() => handleDelete(f)} className="p-2 rounded hover:bg-red-50 text-red-500"><Trash size={14} /></button>
              </div>
              );
            })}
          </div>
        )}

      {editing && <FormEditor form={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
      {embedFor && <EmbedDialog form={embedFor} onClose={() => setEmbedFor(null)} />}
      <Suspense fallback={null}>
        <ConfirmDialog
          open={!!deleteTarget}
          title="Eliminar form"
          message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          tone="destructive"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Suspense>
    </div>
  );
}

const TARGETS_BY_DEST = {
  lead: [
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'telefono', label: 'Telefono' },
    { key: 'notas', label: 'Notas' },
    { key: 'producto_interes_id', label: 'Producto interes (id)' },
    { key: 'utm_source', label: 'UTM source' },
    { key: 'utm_campaign', label: 'UTM campaign' },
  ],
  matricula: [
    { key: 'dni', label: 'DNI / Identificacion', required: true },
    { key: 'titulo', label: 'Titulo / Programa' },
    { key: 'email', label: 'Email' },
    { key: 'notas', label: 'Notas' },
  ],
};

function FormEditor({ form, onSave, onClose }) {
  const [f, setF] = useState({ ...form, config: form.config || {}, field_mapping: form.field_mapping || {}, destination: form.destination || 'lead' });
  const isWebhook = (f.kind || 'form') === 'webhook';
  const [mapping, setMapping] = useState(f.field_mapping || {});
  const [samplePayload, setSamplePayload] = useState(f.sample_payload || null);
  const [listening, setListening] = useState(f.awaiting_sample || false);
  const pollRef = useRef(null);
  const targets = TARGETS_BY_DEST[f.destination] || TARGETS_BY_DEST.lead;

  async function startListening() {
    if (!f.id) { toast({ title: 'Guarda primero el webhook para iniciar la escucha', variant: 'destructive' }); return; }
    try {
      await client.post(`/forms/${f.id}/listen`);
      setListening(true);
      pollRef.current = setInterval(async () => {
        try {
          const r = await client.get(`/forms/${f.id}/status`);
          if (r.success && r.data.sample_payload) {
            setSamplePayload(r.data.sample_payload);
            setListening(false);
            clearInterval(pollRef.current);
            toast({ title: 'Payload recibido', description: 'Click en cualquier campo del arbol para mapearlo.' });
          }
        } catch {}
      }, 2000);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function stopListening() {
    if (f.id) await client.post(`/forms/${f.id}/listen/stop`);
    if (pollRef.current) clearInterval(pollRef.current);
    setListening(false);
  }
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function saveAndClose() {
    onSave({ ...f, field_mapping: isWebhook ? mapping : f.field_mapping });
  }

  const url = f.embed_id ? `${window.location.origin}/testeo_crm/api/forms/webhook/${f.embed_id}` : null;

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border max-w-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-extrabold">{f.id ? 'Editar' : 'Nuevo'} {isWebhook ? 'webhook' : 'form'}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Nombre interno" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />

          {isWebhook ? (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">¿Donde van los datos?</p>
                <div className="grid grid-cols-2 gap-2">
                  {DESTINATIONS.map(d => {
                    const Icon = d.icon;
                    const sel = f.destination === d.v;
                    return (
                      <button key={d.v} type="button" onClick={() => setF({ ...f, destination: d.v })}
                        className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left ${sel ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'}`}>
                        <Icon size={18} weight={sel ? 'fill' : 'regular'} className={sel ? 'text-primary' : 'text-muted-foreground'} />
                        <div>
                          <p className="text-sm font-bold">{d.label}</p>
                          <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {url && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">URL del webhook</p>
                  <div className="flex gap-2"><code className="flex-1 p-2 bg-card rounded text-[11px] overflow-x-auto break-all">{url}</code><button onClick={() => { navigator.clipboard.writeText(url); toast({ title: 'Copiado' }); }} className="p-2 rounded bg-muted"><Copy size={12} /></button></div>
                </div>
              )}

              {f.id && (
                <div className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/10">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">Capturar estructura del payload</p>
                      <p className="text-xs text-muted-foreground">Pulsa, manda un POST de prueba al URL, y los campos aparecen para mapear con un click.</p>
                    </div>
                    {!listening ? (
                      <button onClick={startListening} className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold whitespace-nowrap">Esperar payload</button>
                    ) : (
                      <button onClick={stopListening} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold whitespace-nowrap animate-pulse">Escuchando... (cancelar)</button>
                    )}
                  </div>
                  {listening && <p className="text-xs text-amber-600 mt-2">→ Manda ahora un POST de prueba al URL desde tu sistema externo.</p>}
                </div>
              )}

              {samplePayload && (
                <div>
                  <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Payload capturado · click en un valor para mapearlo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border rounded-xl p-3 bg-muted/10 max-h-72 overflow-y-auto">
                      <PayloadTree obj={samplePayload} path="" mapping={mapping} onSelect={(path) => {
                        const opts = targets.map(t => t.key).join(', ');
                        const target = window.prompt(`Mapea "${path}" a que campo CRM?\nOpciones: ${opts}`);
                        if (target && targets.find(t => t.key === target)) setMapping({ ...mapping, [target]: path });
                      }} />
                    </div>
                    <div className="border border-border rounded-xl p-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-muted-foreground">Mapping → {DESTINATIONS.find(d => d.v === f.destination)?.label}</p>
                      {targets.map(t => (
                        <div key={t.key} className="flex items-center gap-2 text-xs">
                          <span className="w-36 font-bold">{t.label}{t.required && <span className="text-red-500"> *</span>}</span>
                          <code className="flex-1 px-2 py-1 bg-muted/40 rounded text-[10px]">{mapping[t.key] || '(sin mapear)'}</code>
                          {mapping[t.key] && <button onClick={() => { const m = { ...mapping }; delete m[t.key]; setMapping(m); }} className="text-red-500"><X size={12} /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!samplePayload && !f.id && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">Guarda primero el webhook (con un nombre) para poder capturar payload.</p>
              )}
            </>
          ) : (
            <select value={f.template_kind} onChange={e => setF({ ...f, template_kind: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm">
              {KINDS.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
          )}

          {!isWebhook && <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">Texto del boton</span>
              <input value={f.config.button_label || ''} onChange={e => setF({ ...f, config: { ...f.config, button_label: e.target.value } })} placeholder="Enviar" className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">Color principal</span>
              <input type="color" value={f.config.color || '#4361ee'} onChange={e => setF({ ...f, config: { ...f.config, color: e.target.value } })} className="mt-1 w-full h-9 rounded-lg border border-border bg-muted/30" />
            </label>
          </div>
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">Mensaje de exito</span>
            <input value={f.config.success_msg || ''} onChange={e => setF({ ...f, config: { ...f.config, success_msg: e.target.value } })} placeholder="Gracias!" className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">URL de redireccion (opcional)</span>
            <input value={f.config.redirect_url || ''} onChange={e => setF({ ...f, config: { ...f.config, redirect_url: e.target.value } })} placeholder="https://..." className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
          </label>
          </>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />
            Activo
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold">Cancelar</button>
            <button onClick={saveAndClose} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"><FloppyDisk size={14} weight="bold" /> Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedDialog({ form, onClose }) {
  const isWebhook = (form.kind || 'form') === 'webhook';
  function copy(text) { navigator.clipboard.writeText(text); toast({ title: 'Copiado' }); }

  if (isWebhook) {
    const url = `${window.location.origin}/testeo_crm/api/forms/webhook/${form.embed_id}`;
    const samplePayload = JSON.stringify({ nombre: 'Juan', email: 'juan@ej.com', telefono: '+34600000000' }, null, 2);
    const curlEx = `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify({ nombre: 'Juan', email: 'juan@ej.com' })}'`;
    return (
      <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
        <div className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-extrabold">Webhook: {form.nombre}</h3>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-3 text-xs">
            <div>
              <p className="font-bold uppercase text-muted-foreground mb-1">URL del webhook</p>
              <div className="flex gap-2"><code className="flex-1 p-2 bg-muted/40 rounded overflow-x-auto break-all">{url}</code><button onClick={() => copy(url)} className="p-2 rounded bg-muted"><Copy size={12} /></button></div>
              <p className="text-muted-foreground mt-1">Metodo: POST · Content-Type: application/json</p>
            </div>
            <div>
              <p className="font-bold uppercase text-muted-foreground mb-1">Mapping configurado</p>
              <pre className="p-2 bg-muted/40 rounded overflow-x-auto text-[11px]">{JSON.stringify(form.field_mapping || {}, null, 2)}</pre>
              {Object.keys(form.field_mapping || {}).length === 0 && <p className="text-amber-600 mt-1">Sin mapping: el sistema espera keys directas (nombre, email, telefono...)</p>}
            </div>
            <div>
              <p className="font-bold uppercase text-muted-foreground mb-1">Ejemplo curl</p>
              <div className="flex gap-2"><pre className="flex-1 p-2 bg-muted/40 rounded overflow-x-auto whitespace-pre">{curlEx}</pre><button onClick={() => copy(curlEx)} className="p-2 rounded bg-muted self-start"><Copy size={12} /></button></div>
            </div>
            <div>
              <p className="font-bold uppercase text-muted-foreground mb-1">Payload esperado (sin mapping)</p>
              <pre className="p-2 bg-muted/40 rounded overflow-x-auto whitespace-pre">{samplePayload}</pre>
            </div>
            <p className="text-muted-foreground italic">El webhook crea un lead aplicando round-robin de gestores. Recibidos: <strong>{form.submissions_count || 0}</strong></p>
          </div>
        </div>
      </div>
    );
  }

  const apiBase = `${window.location.origin}/testeo_crm/api/forms/public/${form.embed_id}`;
  const iframeSrc = `${window.location.origin}/embed/form/${form.embed_id}`;
  const iframeHtml = `<iframe src="${iframeSrc}" width="100%" height="500" frameborder="0"></iframe>`;
  const scriptHtml = `<div id="crm-form-${form.embed_id}"></div>\n<script src="${window.location.origin}/embed/form.js" data-form-id="${form.embed_id}"></script>`;
  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-extrabold">Embed: {form.nombre}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-xs">
          <div>
            <p className="font-bold uppercase text-muted-foreground mb-1">URL API publico</p>
            <div className="flex gap-2"><code className="flex-1 p-2 bg-muted/40 rounded overflow-x-auto">{apiBase}</code><button onClick={() => copy(apiBase)} className="p-2 rounded bg-muted"><Copy size={12} /></button></div>
          </div>
          <div>
            <p className="font-bold uppercase text-muted-foreground mb-1">Iframe</p>
            <div className="flex gap-2"><code className="flex-1 p-2 bg-muted/40 rounded overflow-x-auto">{iframeHtml}</code><button onClick={() => copy(iframeHtml)} className="p-2 rounded bg-muted"><Copy size={12} /></button></div>
          </div>
          <div>
            <p className="font-bold uppercase text-muted-foreground mb-1">Script (Shadow DOM)</p>
            <div className="flex gap-2"><code className="flex-1 p-2 bg-muted/40 rounded overflow-x-auto whitespace-pre">{scriptHtml}</code><button onClick={() => copy(scriptHtml)} className="p-2 rounded bg-muted"><Copy size={12} /></button></div>
          </div>
          <p className="text-muted-foreground italic">Embed JS y página iframe pendientes; el endpoint API ya funciona y puedes integrarlo desde JS propio.</p>
        </div>
      </div>
    </div>
  );
}

function PayloadTree({ obj, path, onSelect, mapping }) {
  if (obj === null || obj === undefined) return <span className="text-muted-foreground italic">null</span>;
  if (typeof obj !== 'object') {
    const usedAs = Object.entries(mapping || {}).find(([, v]) => v === path)?.[0];
    return (
      <button
        onClick={() => onSelect(path)}
        className={`text-left px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-primary/10 ${usedAs ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ''}`}
        title={usedAs ? `Mapeado a: ${usedAs}` : 'Click para mapear'}
      >
        {String(obj).slice(0, 80)}{usedAs && ` ← ${usedAs}`}
      </button>
    );
  }
  if (Array.isArray(obj)) {
    return (
      <ul className="ml-3 space-y-0.5">
        {obj.slice(0, 5).map((v, i) => (
          <li key={i} className="text-[11px]">
            <span className="text-muted-foreground">[{i}]:</span> <PayloadTree obj={v} path={`${path}.${i}`.replace(/^\./, '')} onSelect={onSelect} mapping={mapping} />
          </li>
        ))}
        {obj.length > 5 && <li className="text-[10px] text-muted-foreground italic">... +{obj.length - 5} mas</li>}
      </ul>
    );
  }
  return (
    <ul className="space-y-0.5">
      {Object.entries(obj).map(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        return (
          <li key={k} className="text-[11px]">
            <span className="font-bold text-foreground">{k}:</span> <PayloadTree obj={v} path={childPath} onSelect={onSelect} mapping={mapping} />
          </li>
        );
      })}
    </ul>
  );
}
