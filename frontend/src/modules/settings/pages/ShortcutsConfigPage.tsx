import { useEffect, useMemo, useState } from 'react';
import {
  Lightning, Check, FloppyDisk, ShieldWarning,
  UserPlus, Buildings, Package, FileText, PlugsConnected,
  EnvelopeSimple, Bell, NotePencil, ArrowsClockwise, ChartBar,
  type Icon,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import client from '@/shared/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/shared/hooks/useToast';
import type { ApiResponse } from '@/shared/types';

interface ShortcutCatalogItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: string;
}

interface ProjectWithShortcuts {
  id: number;
  nombre: string;
  shortcuts?: ShortcutCatalogItem[] | null;
}

// Mapa de string-de-backend → componente Icon de phosphor.
// El backend devuelve nombres de icono como strings (e.g. 'Webhook'); los
// mapeamos al componente correspondiente de phosphor. Los nombres deben
// coincidir con los del catálogo en backend/src/modules/projects/shortcuts.controller.js
const ICON_MAP: Record<string, Icon> = {
  UserPlus,
  Building: Buildings,
  Package,
  FileText,
  Webhook: PlugsConnected,
  Envelope: EnvelopeSimple,
  Bell,
  NotePencil,
  ArrowsClockwise,
  ChartBar,
};

function iconFor(name: string): Icon {
  return ICON_MAP[name] || Lightning;
}

export default function ShortcutsConfigPage() {
  const { user, projects } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === 'superadmin' || role === 'admin';

  const [catalog, setCatalog] = useState<ShortcutCatalogItem[] | null>(null);
  const [projectShortcuts, setProjectShortcuts] = useState<Map<number, Set<string>>>(new Map());
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectList = (projects || []) as ProjectWithShortcuts[];

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [catRes, projRes] = await Promise.all([
          client.get('/projects/shortcuts/catalog') as Promise<ApiResponse<ShortcutCatalogItem[]>>,
          client.get('/projects') as Promise<ApiResponse<ProjectWithShortcuts[]>>,
        ]);
        if (cancelled) return;
        if (catRes.success && catRes.data) setCatalog(catRes.data);
        if (projRes.success && projRes.data) {
          const map = new Map<number, Set<string>>();
          for (const p of projRes.data) {
            const ids = new Set<string>((p.shortcuts || []).map(s => s.id));
            map.set(p.id, ids);
          }
          setProjectShortcuts(map);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error de red');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  function toggle(projectId: number, shortcutId: string): void {
    setProjectShortcuts(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(projectId) || []);
      if (set.has(shortcutId)) set.delete(shortcutId);
      else set.add(shortcutId);
      next.set(projectId, set);
      return next;
    });
    setDirty(prev => new Set(prev).add(projectId));
  }

  async function save(projectId: number): Promise<void> {
    if (!catalog) return;
    setSaving(projectId);
    try {
      const activeIds = projectShortcuts.get(projectId) || new Set();
      // Mantenemos el orden del catálogo y enviamos el item completo (label/icon/route)
      const payload = catalog
        .filter(c => activeIds.has(c.id))
        .map(c => ({ id: c.id, label: c.label, icon: c.icon, route: c.route, action: c.action }));
      const res = await client.put(`/projects/${projectId}/shortcuts`, { shortcuts: payload });
      if ((res as ApiResponse<unknown>).success) {
        setDirty(prev => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        const proj = projectList.find(p => p.id === projectId);
        toast({ title: 'Atajos guardados', description: proj?.nombre || `Proyecto #${projectId}` });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally { setSaving(null); }
  }

  const adminProjects = useMemo(
    () => projectList.filter(p => p.id != null),
    [projectList]
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Atajos rápidos" subtitle="Acciones rápidas configurables por proyecto" />
        <div className="bg-card border border-border rounded-xl p-8 flex items-start gap-4">
          <ShieldWarning size={28} className="text-amber-500 shrink-0" />
          <div>
            <h2 className="font-semibold">Acceso restringido</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Solo Administradores y Superadmin pueden gestionar los atajos por proyecto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Atajos rápidos"
        subtitle="Selecciona qué acciones rápidas estarán disponibles en cada proyecto"
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-72 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!loading && catalog && (
        <div className="grid gap-4 md:grid-cols-2">
          {adminProjects.map(p => {
            const active = projectShortcuts.get(p.id) || new Set();
            const isDirty = dirty.has(p.id);
            const isSaving = saving === p.id;
            return (
              <article key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-sm truncate">{p.nombre}</h3>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {active.size} / {catalog.length} activos
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {catalog.map(item => {
                    const Icon = iconFor(item.icon);
                    const isOn = active.has(item.id);
                    return (
                      <li key={item.id}>
                        <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggle(p.id, item.id)}
                            className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                          />
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isOn ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Icon size={14} weight="duotone" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {item.route || item.action || ''}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
                  {isDirty && !isSaving && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">Cambios sin guardar</span>
                  )}
                  <button
                    type="button"
                    onClick={() => save(p.id)}
                    disabled={!isDirty || isSaving}
                    className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {isSaving ? <ArrowsClockwise size={12} className="animate-spin" /> : <FloppyDisk size={12} />}
                    {isSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && catalog && adminProjects.length === 0 && (
        <div className="bg-muted/40 border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <Lightning size={28} weight="duotone" className="mx-auto mb-2 text-muted-foreground/50" />
          No hay proyectos disponibles para gestionar atajos.
        </div>
      )}

      <section className="bg-muted/40 border border-border rounded-xl p-5 flex items-start gap-3">
        <Check size={18} weight="regular" className="text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Cómo aparecen</p>
          <p>
            Los atajos activos se mostrarán en el botón flotante (FAB) de cada proyecto y en el
            panel lateral. Los cambios surten efecto al cambiar de proyecto activo o tras un
            refresh de la página.
          </p>
        </div>
      </section>
    </div>
  );
}
