import { useEffect, useState } from 'react';
import { Robot, CheckCircle, WarningCircle, Circle, ArrowRight } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { useProjectContext } from '@/contexts/ProjectContext';

/**
 * Los proyectos IA y si están conectados ya (Psicólogo IA, Nutricionista IA,
 * Tarot IA).
 *
 * La pantalla de Integraciones configura UN proyecto: el activo. Eso está bien
 * para cambiar una clave suelta, y mal para la tarea que hay ahora, que es dar
 * de alta varios seguidos. Sin esta lista hay que ir al selector del menú,
 * entrar en cada uno y mirar, y no hay forma de saber si falta alguno.
 *
 * Se limita a los proyectos IA a propósito: son los que se conectan con access
 * token y sin webhook, y son los de la tarea. Los CRM ya están conectados desde
 * hace meses y meterlos aquí convertiría una lista de tres en uno de esos
 * cuadros que nadie mira.
 *
 * Cada fila dice lo que hay que saber ANTES de darla por hecha:
 *
 *   - la sociedad emisora, porque sin ella no hay datos fiscales para la
 *     factura y el segundo escalón del corte no se puede calcular;
 *   - si hay token guardado, y con cuál —enmascarado, nunca entero—;
 *   - cómo fue la última prueba de conexión. Un token guardado y sin probar no
 *     es un proyecto conectado: es un proyecto con un texto guardado.
 */

interface Proyecto {
  id: number;
  nombre: string;
  type: string;
  sociedad_emisora_id: number | null;
  sociedad_nombre?: string | null;
}

interface EstadoStripe {
  has_secret: boolean;
  secret_preview: string | null;
  last_test_status: 'success' | 'error' | null;
  last_test_at: string | null;
}

type Fila = Proyecto & { stripe: EstadoStripe | null; cargando: boolean };

export default function ProyectosIAConectados() {
  const { activeProject, switchProject, projects: losMios } = useProjectContext() as {
    activeProject: { id?: number | null } | null;
    switchProject: (id: number) => void;
    projects: Array<{ id: number }>;
  };
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await client.get<Proyecto[]>('/projects');
        const ia = (r?.data || []).filter((p) => p.type === 'ia');
        if (!vivo) return;
        setFilas(ia.map((p) => ({ ...p, stripe: null, cargando: true })));
        // Uno por proyecto. Son tres: no compensa un endpoint nuevo, y si
        // mañana son treinta esto se nota y se cambia.
        await Promise.all(ia.map(async (p) => {
          let estado: EstadoStripe | null = null;
          try {
            const s = await client.get<EstadoStripe>(`/integrations/stripe?projectId=${p.id}`);
            estado = s?.data || null;
          } catch { estado = null; }
          if (!vivo) return;
          setFilas((prev) => prev.map((f) => (f.id === p.id ? { ...f, stripe: estado, cargando: false } : f)));
        }));
      } catch {
        if (vivo) setFilas([]);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Sin proyectos IA no hay nada que decir, y una caja vacía en una pantalla
  // que ya tiene tres bloques de ayuda estorba.
  if (cargando || filas.length === 0) return null;

  const conectados = filas.filter((f) => f.stripe?.has_secret && f.stripe?.last_test_status === 'success').length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
          <Robot size={20} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Proyectos IA</h3>
          <p className="text-[11px] text-muted-foreground">
            Se conectan con un access token, sin webhook. {conectados} de {filas.length} probados con éxito.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filas.map((f) => {
          const s = f.stripe;
          const conToken = !!s?.has_secret;
          const probado = s?.last_test_status === 'success';
          const fallo = s?.last_test_status === 'error';
          const esElActivo = activeProject?.id === f.id;
          /*
            ¿ESTE PROYECTO ESTÁ ASIGNADO A QUIEN MIRA?

            La lista sale de `/projects`, que a un admin se los da todos. Pero
            el proyecto activo solo puede ser uno de los de SU sesión —los que
            vienen en `/auth/me`—, y `switchProject` descarta en silencio
            cualquier otro.

            Hoy los tres IA no están asignados a nadie: al entrar con Diego,
            `/auth/me` devuelve ISEIH y Psiko Aprende y nada más. Sin esto el
            botón se pulsaba y no pasaba absolutamente nada, que es la peor
            forma de enterarse. Antes de conectar ninguno hay que asignarlos en
            Ajustes → Usuarios.
          */
          const esMio = losMios.some((p) => p.id === f.id);
          return (
            <div key={f.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-[160px]">
                {f.cargando ? <Circle size={14} className="text-muted-foreground animate-pulse" />
                  : probado ? <CheckCircle size={14} weight="fill" className="text-emerald-600" />
                    : fallo ? <WarningCircle size={14} weight="fill" className="text-red-500" />
                      : <Circle size={14} className="text-muted-foreground" />}
                <span className="text-sm font-medium">{f.nombre}</span>
              </div>

              <div className="flex-1 min-w-[220px] text-[11px] text-muted-foreground space-y-0.5">
                <p>
                  {f.sociedad_emisora_id
                    ? <>Sociedad: <span className="text-foreground">{f.sociedad_nombre || `#${f.sociedad_emisora_id}`}</span></>
                    : <span className="text-amber-700 dark:text-amber-400">Sin sociedad emisora — no podrá facturar</span>}
                </p>
                <p>
                  {f.cargando ? 'Consultando…'
                    : !conToken ? <span className="text-amber-700 dark:text-amber-400">Sin access token</span>
                      : <>Token <code className="px-1 rounded bg-muted">{s?.secret_preview || '—'}</code>{' · '}
                        {probado ? <span className="text-emerald-700 dark:text-emerald-400">conexión probada</span>
                          : fallo ? <span className="text-red-600 dark:text-red-400">la última prueba falló</span>
                            : <span className="text-amber-700 dark:text-amber-400">sin probar</span>}
                      </>}
                </p>
              </div>

              {esElActivo ? (
                <span className="text-[11px] text-primary font-semibold px-2">Lo estás configurando abajo</span>
              ) : !esMio ? (
                <span
                  className="text-[11px] text-amber-700 dark:text-amber-400 px-2 text-right max-w-[220px]"
                  title="El proyecto activo solo puede ser uno de los asignados a tu usuario"
                >
                  No está asignado a tu usuario — asígnatelo en Ajustes → Usuarios para poder configurarlo
                </span>
              ) : (
                // Cambia el proyecto activo, que es de quien tira la tarjeta de
                // abajo. Es el mismo estado que el selector del menú, no otro.
                <button
                  type="button"
                  onClick={() => switchProject(f.id)}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-card text-xs font-semibold hover:bg-muted"
                >
                  Configurar <ArrowRight size={12} weight="bold" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
