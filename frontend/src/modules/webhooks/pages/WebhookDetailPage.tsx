import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Copy, FloppyDisk, Power, Users, GraduationCap, Trash,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import { toast } from '@/shared/hooks/useToast';
import ListenModePanel from '../components/ListenModePanel';
import PayloadMapper from '../components/PayloadMapper';
import type { Webhook, WebhookDestination, WebhookFieldMapping } from '../lib/types';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

interface DestinationOption {
  v: WebhookDestination;
  label: string;
  Icon: PhosphorIcon;
  desc: string;
}

const DESTINATIONS: ReadonlyArray<DestinationOption> = [
  { v: 'lead', label: 'Lead / Prospecto', Icon: Users, desc: 'Crea un lead en el embudo (round-robin de gestores)' },
  { v: 'matricula', label: 'Matrícula', Icon: GraduationCap, desc: 'Crea una solicitud de admisión en estado pendiente' },
];

type WebhookDetail = Webhook & { awaiting_sample?: boolean };

export default function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [webhook, setWebhook] = useState<WebhookDetail | null>(null);
  const [mapping, setMapping] = useState<WebhookFieldMapping>({});
  const [samplePayload, setSamplePayload] = useState<Record<string, unknown> | null>(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/forms/${id}`);
      if (res.success && res.data) {
        const w = res.data as WebhookDetail;
        if (w.kind !== 'webhook') {
          toast({ title: 'No es un webhook', variant: 'destructive' });
          navigate('/webhooks', { replace: true });
          return;
        }
        setWebhook(w);
        setMapping(w.field_mapping || {});
        setSamplePayload((w.sample_payload as Record<string, unknown>) || null);
        setListening(w.awaiting_sample || false);
        setDirty(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  function patch(changes: Partial<WebhookDetail>): void {
    setWebhook((w) => (w ? { ...w, ...changes } : w));
    setDirty(true);
  }

  function patchMapping(next: WebhookFieldMapping): void {
    setMapping(next);
    setDirty(true);
  }

  async function save(): Promise<void> {
    if (!webhook) return;
    setSaving(true);
    try {
      const res = await client.patch(`/forms/${id}`, {
        nombre: webhook.nombre,
        destination: webhook.destination,
        field_mapping: mapping,
        active: webhook.active,
      });
      if (res.success) {
        toast({ title: 'Cambios guardados' });
        setDirty(false);
        load();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(): Promise<void> {
    if (!webhook) return;
    try {
      await client.patch(`/forms/${id}`, { active: !webhook.active });
      toast({ title: webhook.active ? 'Apagado' : 'Encendido' });
      load();
    } catch (err: any) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  function remove() {
    setConfirmDelete(true);
  }

  async function doRemove(): Promise<void> {
    setConfirmDelete(false);
    try {
      await client.delete(`/forms/${id}`);
      toast({ title: 'Eliminado' });
      navigate('/webhooks');
    } catch (err: any) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  function copy(text: string): void {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado al portapapeles' });
  }

  if (loading) {
    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Webhook" subtitle="Cargando…" />
      </div>
    );
  }

  if (!webhook) {
    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Webhook no encontrado" />
        <Link to="/webhooks" className="text-sm text-primary hover:underline">← Volver a webhooks</Link>
      </div>
    );
  }

  const url = webhook.embed_id
    ? `${window.location.origin}/testeo_crm/api/forms/webhook/${webhook.embed_id}`
    : null;
  const curlExample = url
    ? `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify({ nombre: 'Juan', email: 'juan@ejemplo.com' })}'`
    : '';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={webhook.nombre}
        subtitle={`${webhook.submissions_count || 0} eventos recibidos · ${webhook.embed_id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/webhooks"
              aria-label="Volver"
              className="flex items-center gap-1 h-9 px-3 rounded-lg border border-border bg-secondary text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={14} /> <span className="hidden sm:inline">Volver</span>
            </Link>
            <button
              onClick={toggleActive}
              aria-label={webhook.active ? 'Apagar' : 'Encender'}
              className={`flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-bold ${
                webhook.active
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Power size={14} weight="bold" /> {webhook.active ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              aria-label="Guardar"
              className="flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
            >
              <FloppyDisk size={14} weight="bold" /> <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        }
      />

      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold uppercase text-muted-foreground">Datos básicos</h3>
        <label className="block">
          <span className="text-xs font-bold text-muted-foreground">Nombre interno</span>
          <input
            value={webhook.nombre}
            onChange={(e) => patch({ nombre: e.target.value })}
            className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm"
          />
        </label>

        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">¿Dónde van los datos?</p>
          <div className="grid grid-cols-2 gap-2">
            {DESTINATIONS.map((d) => {
              const sel = (webhook.destination || 'lead') === d.v;
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => patch({ destination: d.v })}
                  className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left ${
                    sel ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <d.Icon size={18} weight={sel ? 'fill' : 'regular'} className={sel ? 'text-primary' : 'text-muted-foreground'} />
                  <div>
                    <p className="text-sm font-bold">{d.label}</p>
                    <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {url && (
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Endpoint del webhook</h3>
          <div className="flex gap-2">
            <code className="flex-1 p-2.5 bg-muted/40 rounded text-xs overflow-x-auto break-all">{url}</code>
            <button onClick={() => copy(url)} className="h-9 w-9 inline-flex items-center justify-center rounded bg-muted hover:bg-muted/70" aria-label="Copiar URL">
              <Copy size={14} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Método: POST · Content-Type: application/json</p>
          <details className="text-xs">
            <summary className="cursor-pointer font-bold text-muted-foreground">Ejemplo curl</summary>
            <div className="mt-2 flex gap-2">
              <pre className="flex-1 p-2.5 bg-muted/40 rounded overflow-x-auto whitespace-pre text-[11px]">{curlExample}</pre>
              <button onClick={() => copy(curlExample)} className="h-9 w-9 inline-flex items-center justify-center rounded bg-muted hover:bg-muted/70 self-start" aria-label="Copiar curl">
                <Copy size={14} />
              </button>
            </div>
          </details>
        </section>
      )}

      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold uppercase text-muted-foreground">Listen mode</h3>
        <ListenModePanel
          webhookId={webhook.id}
          listening={listening}
          onListeningChange={setListening}
          onPayloadCaptured={(payload) => { setSamplePayload(payload); }}
        />
      </section>

      {samplePayload && (
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Mapeo del payload</h3>
          <PayloadMapper
            payload={samplePayload}
            mapping={mapping}
            destination={webhook.destination || 'lead'}
            onChange={patchMapping}
          />
          <p className="text-xs text-muted-foreground">
            Los cambios en el mapeo no se guardan automáticamente — pulsa &quot;Guardar&quot; para persistir.
          </p>
        </section>
      )}

      <section className="flex justify-end pt-2">
        <button
          onClick={remove}
          className="flex items-center gap-1 h-9 px-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
        >
          <Trash size={12} weight="bold" /> Eliminar webhook
        </button>
      </section>

      <Suspense fallback={null}>
        <ConfirmDialog
          open={confirmDelete}
          title="Eliminar webhook"
          message={`¿Eliminar "${webhook?.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          tone="destructive"
          onConfirm={doRemove}
          onCancel={() => setConfirmDelete(false)}
        />
      </Suspense>
    </div>
  );
}
