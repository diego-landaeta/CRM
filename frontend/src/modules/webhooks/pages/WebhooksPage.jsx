import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlugsConnected, Plus } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import { toast } from '@/shared/hooks/useToast';
import WebhookCard from '../components/WebhookCard';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

export default function WebhooksPage() {
  const { activeProject } = useProjectContext();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await client.get(`/forms?projectId=${activeProject.id}&kind=webhook`);
      if (res.success) setWebhooks(res.data);
    } catch (err) {
      toast({ title: 'Error cargando webhooks', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function createNew() {
    if (!activeProject?.id || creating) return;
    setCreating(true);
    try {
      const res = await client.post('/forms', {
        project_id: activeProject.id,
        nombre: 'Nuevo webhook',
        kind: 'webhook',
        destination: 'lead',
        config: {},
        field_mapping: {},
        active: true,
      });
      if (res.success) {
        toast({ title: 'Webhook creado' });
        navigate(`/webhooks/${res.data.id}`);
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(w) {
    try {
      await client.patch(`/forms/${w.id}`, { active: !w.active });
      toast({ title: w.active ? 'Webhook apagado' : 'Webhook encendido' });
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function toggleListen(w) {
    try {
      if (w.awaiting_sample) await client.post(`/forms/${w.id}/listen/stop`);
      else await client.post(`/forms/${w.id}/listen`);
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
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

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Webhooks"
        subtitle={`${webhooks.length} en ${activeProject?.nombre || 'este proyecto'}`}
        actions={
          <button
            onClick={createNew}
            disabled={creating}
            aria-label="Nuevo webhook"
            className="flex items-center gap-1 h-9 px-3 sm:px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            <Plus size={14} weight="bold" /> <span className="hidden sm:inline">Nuevo webhook</span>
          </button>
        }
      />

      {loading ? (
        <SkeletonTable rows={3} columns={3} />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={PlugsConnected}
          title="Sin webhooks"
          description="Crea un webhook para recibir leads desde sistemas externos (Make, Zapier, n8n, integraciones custom)."
          action={
            <button
              onClick={createNew}
              disabled={creating}
              className="flex items-center gap-1 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
            >
              <Plus size={14} weight="bold" /> Nuevo webhook
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {webhooks.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              onToggleActive={toggleActive}
              onToggleListen={toggleListen}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <ConfirmDialog
          open={!!deleteTarget}
          title="Eliminar webhook"
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
