import { useEffect, useState, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import { ShoppingBag, FloppyDisk, ArrowsClockwise, Eye } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

export default function WooCommercePage() {
  const { activeProject } = useProjectContext();
  const [creds, setCreds] = useState(null);
  const [form, setForm] = useState({ store_url: '', consumer_key: '', consumer_secret: '', auto_sync_enabled: false, sync_interval_minutes: 30 });
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        client.get(`/woocommerce/credentials?projectId=${activeProject.id}`),
        client.get(`/woocommerce/runs?projectId=${activeProject.id}`),
      ]);
      if (c.success) {
        setCreds(c.data);
        if (c.data) setForm({ store_url: c.data.store_url, consumer_key: c.data.consumer_key, consumer_secret: '', auto_sync_enabled: c.data.auto_sync_enabled || false, sync_interval_minutes: c.data.sync_interval_minutes || 30 });
      }
      if (r.success) setRuns(r.data);
    } finally { setLoading(false); }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function saveCreds() {
    try {
      await client.put('/woocommerce/credentials', { project_id: activeProject.id, ...form });
      toast({ title: 'Credenciales guardadas' });
      load();
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function importNow() {
    setImporting(true);
    try {
      await client.post(`/woocommerce/runs/start?projectId=${activeProject.id}`);
      toast({ title: 'Import iniciado en background' });
      setTimeout(load, 3000);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
    finally { setImporting(false); }
  }
  async function preview() {
    try {
      const res = await client.get(`/woocommerce/preview?projectId=${activeProject.id}`);
      if (res.success) toast({ title: `${res.data.count} productos en la tienda`, description: `Sample: ${res.data.sample.map(s => s.name).join(', ')}` });
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="WooCommerce" subtitle="Importar productos desde tu tienda" />

      <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl space-y-3">
        <h3 className="font-bold">Credenciales</h3>
        <input value={form.store_url} onChange={e => setForm({ ...form, store_url: e.target.value })} placeholder="https://tu-tienda.com" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
        <input value={form.consumer_key} onChange={e => setForm({ ...form, consumer_key: e.target.value })} placeholder="Consumer key (ck_...)" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono text-xs" />
        <input value={form.consumer_secret} onChange={e => setForm({ ...form, consumer_secret: e.target.value })} type="password" placeholder={creds ? '(sin cambios — dejar vacio para mantener)' : 'Consumer secret (cs_...)'} className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono text-xs" />

        <div className="pt-3 border-t border-border space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.auto_sync_enabled} onChange={e => setForm({ ...form, auto_sync_enabled: e.target.checked })} />
            <strong>Sincronización automática</strong>
          </label>
          {form.auto_sync_enabled && (
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">Cada cuantos minutos</span>
              <input type="number" min="5" max="1440" value={form.sync_interval_minutes} onChange={e => setForm({ ...form, sync_interval_minutes: Number(e.target.value) })} className="mt-1 w-32 h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
            </label>
          )}
          <p className="text-xs text-muted-foreground">{form.auto_sync_enabled ? `El servidor revisa cada ${form.sync_interval_minutes} min y solo importa si cambia la cantidad de productos en WC.` : 'Sin auto-sync: deberas pulsar "Importar ahora" manualmente.'}</p>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button onClick={saveCreds} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"><FloppyDisk size={14} weight="bold" /> Guardar</button>
        </div>
      </div>

      {creds && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Importar productos</h3>
            <div className="flex gap-2">
              <button onClick={preview} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted text-xs font-bold"><Eye size={14} /> Preview</button>
              <button onClick={importNow} disabled={importing} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"><ArrowsClockwise size={14} weight="bold" /> {importing ? 'Iniciando...' : 'Importar ahora'}</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Trae todos los productos de la tienda. Crea los nuevos y actualiza los existentes (matched por wc_product_id).</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-bold text-sm">Historial de imports</h3></div>
        {loading ? <SkeletonTable rows={4} columns={6} className="border-0" /> : runs.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Sin imports aún" description="Configura credenciales y dispara el primero" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
                  <th className="text-left px-4 py-2.5 font-bold">Inicio</th>
                  <th className="text-center px-4 py-2.5 font-bold">Estado</th>
                  <th className="text-right px-4 py-2.5 font-bold">Fetched</th>
                  <th className="text-right px-4 py-2.5 font-bold">Created</th>
                  <th className="text-right px-4 py-2.5 font-bold">Updated</th>
                  <th className="text-right px-4 py-2.5 font-bold">Skipped</th>
                  <th className="text-left px-4 py-2.5 font-bold">Error</th>
                </tr></thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-xs">{new Date(r.started_at).toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.total_fetched}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.total_created}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600">{r.total_updated}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.total_skipped}</td>
                      <td className="px-4 py-3 text-xs text-red-500 truncate max-w-[200px]">{r.error_message || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {runs.map(r => (
                <div key={r.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString('es-ES')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Fetched</div><div className="tabular-nums">{r.total_fetched}</div></div>
                    <div><div className="text-muted-foreground">Created</div><div className="tabular-nums text-emerald-600">{r.total_created}</div></div>
                    <div><div className="text-muted-foreground">Updated</div><div className="tabular-nums text-blue-600">{r.total_updated}</div></div>
                    <div><div className="text-muted-foreground">Skipped</div><div className="tabular-nums text-muted-foreground">{r.total_skipped}</div></div>
                  </div>
                  {r.error_message && <p className="text-[11px] text-red-500 break-words">{r.error_message}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
