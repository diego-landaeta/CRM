import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import { GraduationCap, CheckCircle, XCircle, Clock, Eye, Upload, X, PlugsConnected, Plus, Copy, Trash } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import PromptDialog from '@/shared/components/ui/PromptDialog';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

const ESTADO_LABEL = {
  solicitud_admision: 'Solicitud admisión',
  datos_validados: 'Datos validados',
  pendiente: 'Pendiente',
  validada: 'Validada',
  rechazada: 'Rechazada',
};
const ESTADO_COLOR = {
  solicitud_admision: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900',
  datos_validados: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
  pendiente: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  validada: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  rechazada: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
};

export default function MatriculasPage() {
  const { activeProject } = useProjectContext();
  const [tab, setTab] = useState('list');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, validadas: 0, rechazadas: 0 });
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [rechazoTarget, setRechazoTarget] = useState(null);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: activeProject.id });
      if (filterEstado) params.set('estado', filterEstado);
      if (search) params.set('search', search);
      const res = await client.get(`/matriculas?${params}`);
      if (res.success) { setData(res.data || []); setStats(res.stats || {}); }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [activeProject?.id, filterEstado, search]);

  useEffect(() => { load(); }, [load]);

  async function handleEstado(m, estado) {
    if (estado === 'rechazada') {
      setRechazoTarget(m);
      return;
    }
    try {
      await client.post(`/matriculas/${m.id}/estado`, { estado, motivo_rechazo: null });
      toast({ title: 'Validada' });
      load();
      if (detail?.id === m.id) setDetail(null);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function confirmRechazo(motivo) {
    if (!rechazoTarget || !motivo) return;
    const m = rechazoTarget;
    setRechazoTarget(null);
    try {
      await client.post(`/matriculas/${m.id}/estado`, { estado: 'rechazada', motivo_rechazo: motivo });
      toast({ title: 'Rechazada' });
      load();
      if (detail?.id === m.id) setDetail(null);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Matrículas" subtitle={`${stats.total || 0} matrículas en ${activeProject?.nombre || 'este proyecto'}`} />

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('list')}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-bold border-b-2 focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          <GraduationCap size={14} /> Listado
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-bold border-b-2 focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'webhooks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          <PlugsConnected size={14} /> <span className="hidden sm:inline">Webhooks de admisión</span><span className="sm:hidden">Webhooks</span>
        </button>
      </div>

      {tab === 'webhooks' ? <WebhookTokensTab project={activeProject} /> : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, color: '#64748b' },
          { label: 'Pendientes', value: stats.pendientes, color: '#d97706' },
          { label: 'Validadas', value: stats.validadas, color: '#059669' },
          { label: 'Rechazadas', value: stats.rechazadas, color: '#dc2626' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 border-b-2" style={{ borderBottomColor: k.color }}>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">{k.label}</p>
            <p className="text-xl font-extrabold mt-0.5" style={{ color: k.color }}>{k.value || 0}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Buscar nombre/email/DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Buscar matrículas"
          className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          aria-label="Filtrar por estado"
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos los estados</option>
          <option value="solicitud_admision">Solicitud admisión</option>
          <option value="datos_validados">Datos validados</option>
          <option value="pendiente">Pendientes</option>
          <option value="validada">Validadas</option>
          <option value="rechazada">Rechazadas</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? <SkeletonTable rows={5} columns={6} /> : data.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Sin matrículas" description="Aparece aquí cuando se crea una matrícula desde una conversión" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Lead</th>
                    <th className="text-left px-4 py-2.5 font-bold">DNI</th>
                    <th className="text-left px-4 py-2.5 font-bold">Producto</th>
                    <th className="text-right px-4 py-2.5 font-bold">Importe</th>
                    <th className="text-center px-4 py-2.5 font-bold">Estado</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{m.lead_nombre || '—'}</div>
                        <div className="text-xs text-muted-foreground">{m.lead_email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{m.dni || '—'}</td>
                      <td className="px-4 py-3 text-xs">{m.producto_contratado || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(m.importe_total || 0).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_COLOR[m.estado]}`}>{ESTADO_LABEL[m.estado]}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetail(m)}
                          aria-label="Ver detalle de matrícula"
                          className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {data.map(m => (
                <div key={m.id} className="p-3 flex items-start gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_COLOR[m.estado]}`}>{ESTADO_LABEL[m.estado]}</span>
                      <span className="text-sm font-bold tabular-nums">{Number(m.importe_total || 0).toFixed(2)} €</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{m.lead_nombre || '—'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.lead_email}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.producto_contratado || 'Sin producto'}{m.dni ? ` · ${m.dni}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setDetail(m)}
                      aria-label="Ver detalle de matrícula"
                      className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      </>}

      {detail && <MatriculaDetail matricula={detail} onClose={() => setDetail(null)} onChange={load} onEstado={handleEstado} />}
      <PromptDialog
        open={!!rechazoTarget}
        title="Rechazar matrícula"
        message="Indica el motivo del rechazo para que el solicitante pueda recibirlo."
        placeholder="Ej: documentación incompleta o ilegible…"
        multiline
        confirmLabel="Rechazar"
        onConfirm={confirmRechazo}
        onCancel={() => setRechazoTarget(null)}
      />
    </div>
  );
}

function WebhookTokensTab({ project }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const res = await client.get(`/webhook-tokens?projectId=${project.id}&kind=matriculas`);
      if (res.success) setTokens(res.data);
    } catch (err) {
      toast({ title: 'Error cargando webhooks de admisión', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data) {
    try {
      await client.post('/webhook-tokens', { project_id: project.id, kind: 'matriculas', ...data });
      toast({ title: 'Webhook creado' });
      setCreating(false);
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function handleUpdate(t, data) {
    try {
      await client.patch(`/webhook-tokens/${t.id}`, data);
      toast({ title: 'Guardado' });
      setEditing(null);
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  function handleDelete(t) { setPendingDelete(t); }
  async function doDelete() {
    try { await client.delete(`/webhook-tokens/${pendingDelete.id}`); load(); }
    catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
    finally { setPendingDelete(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Crea webhooks para recibir solicitudes de admisión desde formularios externos. Cada solicitud crea una matrícula en estado <strong>solicitud_admision</strong>. Dedupe automático por DNI o email.</p>
        <button
          onClick={() => setCreating(true)}
          aria-label="Nuevo webhook"
          className="flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Plus size={14} weight="bold" /> <span className="hidden sm:inline">Nuevo webhook</span>
        </button>
      </div>

      {loading ? <SkeletonTable rows={3} columns={3} /> : tokens.length === 0 ? (
        <EmptyState icon={PlugsConnected} title="Sin webhooks" description="Crea uno para recibir solicitudes desde tu formulario de admisión externo" />
      ) : (
        <div className="space-y-2">
          {tokens.map(t => <WebhookCard key={t.id} token={t} onEdit={() => setEditing(t)} onDelete={() => handleDelete(t)} />)}
        </div>
      )}

      {(creating || editing) && (
        <WebhookEditor token={editing} onSave={editing ? (d => handleUpdate(editing, d)) : handleCreate} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      <Suspense fallback={null}>
        <ConfirmDialog
          open={pendingDelete !== null}
          title="¿Eliminar webhook?"
          message="Las solicitudes pendientes no se borrarán, pero el webhook dejará de aceptar nuevas."
          confirmLabel="Eliminar"
          tone="destructive"
          onConfirm={doDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </Suspense>
    </div>
  );
}

function WebhookCard({ token, onEdit, onDelete }) {
  const url = `${window.location.origin}/testeo_crm/api/webhook-tokens/receive/${token.token}`;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-sm">{token.notas || 'Webhook admisión'}</p>
          <p className="text-xs text-muted-foreground">{token.uses_count || 0} usos · última vez: {token.last_used_at ? new Date(token.last_used_at).toLocaleString('es-ES') : 'nunca'}{!token.active && ' · INACTIVO'}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="h-9 px-3 rounded bg-muted text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            aria-label="Eliminar webhook"
            className="h-9 w-9 inline-flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <code className="flex-1 p-2 bg-muted/40 rounded text-[11px] overflow-x-auto break-all">{url}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(url); toast({ title: 'Copiado' }); }}
          aria-label="Copiar URL del webhook"
          className="p-2 rounded bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Copy size={12} />
        </button>
      </div>
      {Object.keys(token.field_mapping || {}).length > 0 && (
        <pre className="text-[10px] p-2 bg-muted/30 rounded overflow-x-auto">{JSON.stringify(token.field_mapping, null, 2)}</pre>
      )}
    </div>
  );
}

// Targets validos para matriculas
const MATRICULA_TARGETS = [
  { key: 'dni', label: 'DNI / Identificación' },
  { key: 'titulo', label: 'Título / Programa' },
  { key: 'email', label: 'Email' },
  { key: 'notas', label: 'Notas / Comentarios' },
];

function WebhookEditor({ token, onSave, onClose }) {
  const [notas, setNotas] = useState(token?.notas || '');
  const [active, setActive] = useState(token ? token.active : true);
  const [mapping, setMapping] = useState(token?.field_mapping || {});
  const [samplePayload, setSamplePayload] = useState(token?.sample_payload || null);
  const [listening, setListening] = useState(false);
  const [mapPath, setMapPath] = useState(null);
  const pollRef = useState({ current: null })[0];

  // Si es nuevo (sin id), crearlo en draft y abrir listen
  async function startListening() {
    if (!token?.id) {
      toast({ title: 'Guarda primero el webhook para iniciar la escucha', variant: 'destructive' });
      return;
    }
    try {
      await client.post(`/webhook-tokens/${token.id}/listen`);
      setListening(true);
      // Polling cada 2s
      pollRef.current = setInterval(async () => {
        try {
          const r = await client.get(`/webhook-tokens/${token.id}/status`);
          if (r.success && r.data.sample_payload) {
            setSamplePayload(r.data.sample_payload);
            setListening(false);
            clearInterval(pollRef.current);
            toast({ title: 'Payload recibido', description: 'Mapea los campos clickeando.' });
          }
        } catch {}
      }, 2000);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function stopListening() {
    if (token?.id) await client.post(`/webhook-tokens/${token.id}/listen/stop`);
    if (pollRef.current) clearInterval(pollRef.current);
    setListening(false);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, [pollRef]);

  function save() {
    onSave({ notas, active, field_mapping: mapping });
  }

  const url = token?.token ? `${window.location.origin}/testeo_crm/api/webhook-tokens/receive/${token.token}` : null;

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="webhook-editor-title" className="bg-card rounded-2xl border border-border max-w-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 id="webhook-editor-title" className="font-extrabold">{token ? 'Editar' : 'Nuevo'} webhook de admisión</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar editor"
            className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Nombre / Descripción (ej: Form admisión web 2026)" className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40" />

          {url && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">URL del webhook</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-card rounded text-[11px] overflow-x-auto break-all">{url}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(url); toast({ title: 'Copiado' }); }}
                  aria-label="Copiar URL"
                  className="p-2 rounded bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          )}

          {token?.id && (
            <div className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-sm">Capturar estructura del payload</p>
                  <p className="text-xs text-muted-foreground">Estilo Make/Zapier: pulsa "Esperar payload", manda una petición de prueba al URL, y los campos aparecen para mapear con un click.</p>
                </div>
                {!listening ? (
                  <button onClick={startListening} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary/40">Esperar payload</button>
                ) : (
                  <button onClick={stopListening} className="h-9 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold whitespace-nowrap animate-pulse focus:outline-none focus:ring-2 focus:ring-amber-500/40">Escuchando... (cancelar)</button>
                )}
              </div>
              {listening && <p className="text-xs text-amber-600 mt-2">→ Manda ahora un POST de prueba al URL de arriba con tu sistema externo o curl.</p>}
            </div>
          )}

          {samplePayload && (
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Payload capturado · Click en un campo para mapearlo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-xl p-3 bg-muted/10 max-h-64 overflow-y-auto">
                  <PayloadTree obj={samplePayload} path="" onSelect={(path) => setMapPath(path)} mapping={mapping} />
                </div>
                <div className="border border-border rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Mapping CRM</p>
                  {MATRICULA_TARGETS.map(t => (
                    <div key={t.key} className="flex items-center gap-2 text-xs">
                      <span className="w-32 font-bold">{t.label}</span>
                      <code className="flex-1 px-2 py-1 bg-muted/40 rounded text-[10px]">{mapping[t.key] || '(sin mapear)'}</code>
                      {mapping[t.key] && (
                        <button
                          onClick={() => { const m = { ...mapping }; delete m[t.key]; setMapping(m); }}
                          aria-label={`Quitar mapping de ${t.label}`}
                          className="text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!samplePayload && (
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Mapping manual (opcional)</p>
              <p className="text-xs text-muted-foreground mb-2">Si no quieres usar la captura, escribe el JSON directamente.</p>
              <textarea defaultValue={JSON.stringify(mapping, null, 2)} onBlur={e => { try { setMapping(JSON.parse(e.target.value || '{}')); } catch {} }} rows={5} className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          )}

          <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Activo</label>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40">Cancelar</button>
            <button onClick={save} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40">Guardar</button>
          </div>
        </div>
      </div>
      <PromptDialog
        open={!!mapPath}
        title="Mapear campo del payload"
        message={mapPath ? <>Selecciona a qué campo del CRM mapear <code className="font-mono text-foreground">{mapPath}</code>.</> : null}
        options={MATRICULA_TARGETS.map(t => ({ value: t.key, label: t.label }))}
        confirmLabel="Mapear"
        onConfirm={(target) => {
          if (target && MATRICULA_TARGETS.find(t => t.key === target)) {
            setMapping({ ...mapping, [target]: mapPath });
          }
          setMapPath(null);
        }}
        onCancel={() => setMapPath(null)}
      />
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
        className={`text-left px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40 ${usedAs ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ''}`}
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
        {obj.length > 5 && <li className="text-[10px] text-muted-foreground italic">... +{obj.length - 5} más</li>}
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

function MatriculaDetail({ matricula, onClose, onChange, onEstado }) {
  const [m, setM] = useState(matricula);
  const [uploading, setUploading] = useState(null);

  async function handleUpload(tipo, file) {
    if (!file) return;
    setUploading(tipo);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await client.post(`/matriculas/${m.id}/doc/${tipo}`, fd);
      if (res.success) { setM(res.data); toast({ title: 'Documento subido' }); onChange(); }
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
    finally { setUploading(null); }
  }

  async function handleSaveCampos() {
    try {
      const res = await client.patch(`/matriculas/${m.id}`, { dni: m.dni || null, titulo: m.titulo || null, notas: m.notas || null });
      if (res.success) { setM(res.data); toast({ title: 'Guardado' }); onChange(); }
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="matricula-detail-title" className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 id="matricula-detail-title" className="font-extrabold">{m.lead_nombre}</h3>
            <p className="text-xs text-muted-foreground">{m.producto_contratado} · {m.lead_email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">DNI</span>
              <input value={m.dni || ''} onChange={e => setM({ ...m, dni: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">Título</span>
              <input value={m.titulo || ''} onChange={e => setM({ ...m, titulo: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
          </div>
          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">Notas</span>
            <textarea value={m.notas || ''} onChange={e => setM({ ...m, notas: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <button
            onClick={handleSaveCampos}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Guardar campos
          </button>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
            {['dni', 'titulo', 'firma'].map(tipo => (
              <div key={tipo} className="border border-border rounded-xl p-3">
                <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">{tipo}</p>
                {m[tipo === 'firma' ? 'firma_url' : `${tipo}_doc_url`] ? (
                  <a href={m[tipo === 'firma' ? 'firma_url' : `${tipo}_doc_url`]} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver documento</a>
                ) : <p className="text-xs text-muted-foreground">Sin doc</p>}
                <label className="block mt-2 cursor-pointer">
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => handleUpload(tipo, e.target.files?.[0])} />
                  <span className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-[11px] font-bold hover:bg-muted/70"><Upload size={12} /> {uploading === tipo ? 'Subiendo...' : 'Subir'}</span>
                </label>
              </div>
            ))}
          </div>

          {m.estado === 'rechazada' && m.motivo_rechazo && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs text-red-700 dark:text-red-300"><strong>Motivo:</strong> {m.motivo_rechazo}</div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            {m.estado !== 'validada' && (
              <button
                onClick={() => onEstado(m, 'validada')}
                className="flex items-center gap-1 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <CheckCircle size={14} weight="bold" /> Validar
              </button>
            )}
            {m.estado !== 'rechazada' && (
              <button
                onClick={() => onEstado(m, 'rechazada')}
                className="flex items-center gap-1 h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/40"
              >
                <XCircle size={14} weight="bold" /> Rechazar
              </button>
            )}
            {m.estado !== 'pendiente' && (
              <button
                onClick={() => onEstado(m, 'pendiente')}
                className="flex items-center gap-1 h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <Clock size={14} weight="bold" /> Pendiente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
