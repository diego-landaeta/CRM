import { useCallback, useEffect, useState } from 'react';
import {
  Plus, PlugsConnected, ArrowClockwise, Trash, PencilSimple,
  CheckCircle, XCircle, WarningCircle, Clock, MagicWand, DownloadSimple,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { toast } from '@/shared/hooks/useToast';
import { useProjectContext } from '@/contexts/ProjectContext';
import {
  conectoresApi, TIPOS, DESTINOS, type Conector,
} from '../api/connectors.api';
import DialogoConector from '../components/DialogoConector';
import { lista } from '@/shared/lib/lista';
import PanelMapeo from '../components/PanelMapeo';

/**
 * Conectores de un proyecto (#6).
 *
 * Traer al CRM lo que ya existe fuera —los productos de una tienda WooCommerce,
 * las entradas de un WordPress— sin copiarlo a mano.
 *
 * El backend estaba hecho desde `bcf9c3e` y no habia forma de usarlo: ni
 * pantalla, ni modulo en el frontend. Esto es la puerta.
 */

const nombreTipo = (t: string) => TIPOS.find((x) => x.id === t)?.label || t;
const nombreDestino = (d: string) => DESTINOS.find((x) => x.id === d)?.label || d;

/** «hace 12 min», «hace 5 meses», «nunca». */
function hace(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 31) return `hace ${d} día${d > 1 ? 's' : ''}`;
  return `hace ${Math.floor(d / 30)} meses`;
}

/** Como fue la ultima importacion, dicho y con color. */
function Estado({ c }: { c: Conector }) {
  if (!c.last_sync_at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={13} /> Sin importar todavía
      </span>
    );
  }
  const cuantos = c.last_sync_count ?? 0;
  if (c.last_sync_status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle size={13} weight="fill" /> {cuantos} traídos · {hace(c.last_sync_at)}
      </span>
    );
  }
  if (c.last_sync_status === 'partial') {
    // «0 traídos, hubo fallos» tiene que leerse distinto de «12 traídos, hubo
    // fallos»: en el primero no entró NADA y el mensaje no puede sonar a que sí.
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <WarningCircle size={13} weight="fill" />
        {cuantos === 0
          ? `No entró ninguno: todos fallaron · ${hace(c.last_sync_at)}`
          : `${cuantos} traídos, algunos fallaron · ${hace(c.last_sync_at)}`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
      <XCircle size={13} weight="fill" /> Falló · {hace(c.last_sync_at)}
    </span>
  );
}

export default function ConnectorsPage() {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id;

  const [conectores, setConectores] = useState<Conector[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // `undefined` = cerrado; `null` = alta; un conector = cambio.
  const [editando, setEditando] = useState<Conector | null | undefined>(undefined);
  const [mapeando, setMapeando] = useState<Conector | null>(null);
  const [importando, setImportando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!projectId) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    try {
      const r = await conectoresApi.listar(projectId);
      if (r.success) setConectores(lista<Conector>(r.data));
      else setError(r.error || 'No se pudieron cargar los conectores');
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los conectores');
    } finally { setCargando(false); }
  }, [projectId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function borrar(c: Conector) {
    // Se pregunta con el nombre delante. Borrar un conector no borra lo ya
    // importado, y eso conviene decirlo o parece que se lleva los productos.
    if (!window.confirm(
      `Se va a borrar el conector «${c.label}».\n\n`
      + 'Lo que ya se importó se queda en el CRM; lo que deja de funcionar es traer más. ¿Seguir?'
    )) return;
    try {
      const r = await conectoresApi.borrar(c.id);
      if (!r.success) throw new Error((r as { error?: string }).error || 'no se pudo');
      toast({ title: 'Conector borrado' });
      cargar();
    } catch (e: any) {
      toast({ title: 'No se pudo borrar', description: e?.message, variant: 'destructive' });
    }
  }

  /**
   * Lanza la importacion.
   *
   * El servidor contesta 202 en seguida y sigue por su cuenta, asi que el estado
   * no llega en la respuesta: se relee la lista a los pocos segundos. Se avisa de
   * que puede tardar en vez de dejar un boton girando sin explicacion.
   */
  async function importar(c: Conector) {
    if (!Object.keys(c.field_mapping || {}).length) {
      toast({
        title: 'Antes hay que mapear',
        description: 'Sin decir a qué campo va cada dato, la importación no puede crear nada.',
        variant: 'destructive',
      });
      setMapeando(c);
      return;
    }
    setImportando(c.id);
    try {
      const r = await conectoresApi.importar(c.id);
      if (!r.success) throw new Error((r as { error?: string }).error || 'no se pudo lanzar');
      toast({
        title: 'Importación lanzada',
        description: 'Va por detrás. El resultado aparece aquí en cuanto termine.',
      });
      // Dos releidas: una pronto por si fue rapido, otra por si no.
      setTimeout(cargar, 3000);
      setTimeout(() => { cargar(); setImportando(null); }, 12000);
    } catch (e: any) {
      toast({ title: 'No se pudo lanzar', description: e?.message, variant: 'destructive' });
      setImportando(null);
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Conectores" subtitle="Traer al CRM lo que ya existe fuera." />
        <EmptyState
          icon={PlugsConnected}
          title="Elige un proyecto"
          description="Los conectores son de cada proyecto. Selecciona uno arriba para ver los suyos."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Conectores"
        subtitle={`Traer al CRM lo que ya existe fuera · ${activeProject?.nombre || ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={cargar} disabled={cargando}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-bold hover:bg-muted disabled:opacity-50">
              <ArrowClockwise size={15} className={cargando ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button type="button" onClick={() => setEditando(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90">
              <Plus size={15} weight="bold" /> Nuevo conector
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200/60 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
          <XCircle size={16} weight="fill" className="text-red-600 shrink-0" /> {error}
        </div>
      )}

      {cargando && !conectores.length ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : !conectores.length ? (
        <EmptyState
          icon={PlugsConnected}
          title="Todavía no hay conectores"
          description="Un conector trae al CRM lo que ya tienes en otro sitio: los productos de una tienda WooCommerce, las entradas de un WordPress, o cualquier API que devuelva JSON."
          action={
            <button type="button" onClick={() => setEditando(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90">
              <Plus size={15} weight="bold" /> Crear el primero
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {conectores.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-card shadow-sm p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <PlugsConnected size={18} weight="duotone" className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{c.label}</h3>
                    {!c.active && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Apagado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {nombreTipo(c.type)} → {nombreDestino(c.destination)}
                  </p>
                  {c.config?.base_url && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{c.config.base_url}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" title="Editar" onClick={() => setEditando(c)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                    <PencilSimple size={15} />
                  </button>
                  <button type="button" title="Borrar" onClick={() => borrar(c)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-muted">
                    <Trash size={15} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <Estado c={c} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => setMapeando(c)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-bold hover:bg-muted">
                    <MagicWand size={12} /> Probar y mapear
                  </button>
                  <button type="button" onClick={() => importar(c)} disabled={importando === c.id}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    <DownloadSimple size={12} /> {importando === c.id ? 'Importando…' : 'Importar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mapeando && (
        <PanelMapeo
          conector={mapeando}
          onCerrar={() => setMapeando(null)}
          onCambiado={() => { setMapeando(null); cargar(); }}
        />
      )}

      {editando !== undefined && (
        <DialogoConector
          conector={editando}
          projectId={projectId}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => { setEditando(undefined); cargar(); }}
        />
      )}
    </div>
  );
}
