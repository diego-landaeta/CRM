import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, UsersThree } from '@phosphor-icons/react';
import { queueApi, type EstadoDeLaCola, type GestorEnCola } from '../api/queue.api';

/**
 * A quien le toca el proximo lead (#11).
 *
 * El round-robin reparte solo y el equipo no lo veia: se enteraban cuando el
 * lead ya estaba asignado, y la pregunta «¿a quien le toca?» se contestaba
 * mirando la lista a ojo. El endpoint existia desde hace tiempo y no lo llamaba
 * nadie.
 *
 * Se refresca cada 30 segundos y cuando se crea un lead —que es cuando el turno
 * avanza de verdad— para no ensenar un turno que ya paso.
 *
 * Si algo falla, NO se pinta nada. Es un panel informativo encima de la lista de
 * prospectos: un error aqui no puede tapar el trabajo, y un panel a medias
 * enganaria mas que no tenerlo.
 */

const CADA_MS = 30000;

/** «hace 5 min», que es como se lee un turno. */
export function desdeHace(iso: string | null): string | null {
  if (!iso) return null;
  const cuando = new Date(iso).getTime();
  if (Number.isNaN(cuando)) return null;
  const segundos = Math.round((Date.now() - cuando) / 1000);
  if (segundos < 0) return 'ahora mismo';
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

/** Las iniciales, para cuando no hay foto. */
const iniciales = (nombre: string) =>
  (nombre || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((t) => t[0] ?? '')
    .join('')
    .toUpperCase() || '?';

function Cara({ gestor, destacado = false }: { gestor: GestorEnCola; destacado?: boolean }) {
  return gestor.avatar_url ? (
    <img
      src={gestor.avatar_url}
      alt=""
      className={`h-7 w-7 rounded-full object-cover ${destacado ? 'ring-2 ring-primary' : ''}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-semibold
                  bg-muted text-muted-foreground ${destacado ? 'ring-2 ring-primary' : ''}`}
    >
      {iniciales(gestor.nombre)}
    </span>
  );
}

export default function PanelDeCola({
  projectId,
  recargarCon,
}: {
  projectId: number | null | undefined;
  /** Cambia este valor al crear un lead y el panel se pone al dia. */
  recargarCon?: unknown;
}) {
  const [estado, setEstado] = useState<EstadoDeLaCola | null>(null);
  const [fallo, setFallo] = useState(false);

  const traer = useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await queueApi.estado(projectId);
      if (r?.success && r.data) {
        setEstado(r.data);
        setFallo(false);
      } else {
        setFallo(true);
      }
    } catch {
      setFallo(true);
    }
  }, [projectId]);

  useEffect(() => {
    traer();
    const id = setInterval(traer, CADA_MS);
    return () => clearInterval(id);
  }, [traer, recargarCon]);

  if (!projectId || fallo || !estado) return null;

  const { gestores, next_gestor: siguiente, last_gestor: ultimo, last_assigned_at: cuando } = estado;

  // Sin gestores no hay reparto que ensenar, y decirlo importa: significa que
  // los leads de este proyecto entran SIN asignar a nadie.
  if (!gestores.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2
                      text-sm text-muted-foreground">
        <UsersThree size={18} aria-hidden="true" />
        <span>
          <strong className="text-foreground">Sin gestores configurados</strong> — los prospectos
          de este proyecto entran sin asignar.
        </span>
      </div>
    );
  }

  const hace = desdeHace(cuando);

  return (
    <section
      aria-label="Reparto de prospectos"
      className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-x-6 gap-y-3"
    >
      {siguiente && (
        <div className="flex items-center gap-2 min-w-0">
          <ArrowRight size={16} className="text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm text-muted-foreground shrink-0">Próximo prospecto</span>
          <Cara gestor={siguiente} destacado />
          <span className="text-sm font-semibold text-foreground truncate">{siguiente.nombre}</span>
        </div>
      )}

      {ultimo && (
        <p className="text-xs text-muted-foreground">
          Último asignado: <span className="text-foreground">{ultimo.nombre}</span>
          {hace ? ` · ${hace}` : ''}
        </p>
      )}

      {/* El orden completo, que es lo que hace entendible el turno: sin verlo,
          «le toca a Carlos» es un dato suelto que hay que creerse. */}
      <ol className="flex items-center gap-1.5 ml-auto" aria-label="Orden de reparto">
        {gestores.map((g) => {
          const esElSiguiente = g.id === siguiente?.id;
          return (
            <li key={g.id} title={`${g.nombre}${esElSiguiente ? ' · le toca el próximo' : ''}`}>
              <Cara gestor={g} destacado={esElSiguiente} />
              <span className="sr-only">
                {g.nombre}
                {esElSiguiente ? ' — le toca el próximo prospecto' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
