import { useState } from 'react';
import { ArrowRight, Info, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/shared/hooks/useToast';
import { repartirPendientes, type GestorEnCola } from '../api/queue.api';
import useQueueState from '../hooks/useQueueState';

interface Props {
  projectId?: number;
  /** Se llama tras repartir, para que el listado se entere. */
  onRepartido?: () => void;
}

const COLORES_AVATAR = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function iniciales(nombre: string): string {
  if (!nombre) return '??';
  return nombre.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ gestor, destacado = false }: { gestor: GestorEnCola; destacado?: boolean }) {
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
        COLORES_AVATAR[gestor.id % COLORES_AVATAR.length]
      } ${destacado ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
    >
      {iniciales(gestor.nombre)}
    </span>
  );
}

/** «hace 5 min», «hace 3 días»… a partir de una fecha. */
function desdeHace(iso: string | null): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d !== 1 ? 's' : ''}`;
  const m = Math.floor(d / 30);
  return `hace ${m} mes${m !== 1 ? 'es' : ''}`;
}

/**
 * A quién le toca el siguiente prospecto.
 *
 * El panel tiene dos caras, y cuál se pinta no lo decide un ajuste sino la
 * realidad del proyecto:
 *
 *  · Si la cola del CRM se mueve, enseña el turno: siguiente, último y el orden.
 *  · Si han entrado prospectos y la cola sigue quieta, es que los reparte otro
 *    —hoy, Make—. Entonces dice eso, en vez de un «siguiente» que sería el
 *    mismo nombre para siempre.
 *
 * La segunda cara existe porque el endpoint calcula el siguiente como
 * `gestores[(último + 1) % total]`, y eso devuelve un nombre aunque el índice
 * lleve meses sin moverse. Sin este contraste, el panel enseñaría una cola
 * muerta con toda la seguridad del mundo.
 */
export default function PanelCola({ projectId, onRepartido }: Props) {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  // El listado de prospectos le devuelve a la gestora solo los suyos, así que
  // con su sesión el conteo saldría una fracción del real y el panel podría
  // dar por viva una cola muerta. Para ella no se cuenta, y no se afirma.
  const puedeContar = user?.role !== 'gestor';
  const { estado, salud, posteriores, error, recargar } = useQueueState(projectId, puedeContar);
  const [repartiendo, setRepartiendo] = useState(false);

  async function repartir() {
    if (!projectId) return;
    setRepartiendo(true);
    try {
      const r = await repartirPendientes(projectId);
      const n = r.reassigned || 0;
      toast({
        title: n > 0 ? 'Prospectos repartidos' : 'No había nada que repartir',
        description: n > 0
          ? `${n} prospecto${n !== 1 ? 's' : ''} sin responsable ${n !== 1 ? 'han' : 'ha'} pasado a la cola.`
          : 'Todos los prospectos ya tienen a alguien asignado.',
      });
      recargar();
      onRepartido?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setRepartiendo(false);
    }
  }

  // Mientras carga no se ocupa sitio: el listado es lo que se viene a ver.
  if (!projectId || salud === 'cargando') return null;

  // Si la cola no se puede leer, el panel desaparece en vez de poner un aviso
  // rojo encima del listado. Esto es información de apoyo: que falle no puede
  // estorbar para trabajar con los prospectos, que es a lo que se viene.
  if (error) return null;

  if (salud === 'sin_gestores') {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-2.5">
        <UsersThree size={16} className="text-muted-foreground flex-shrink-0" />
        <div className="text-xs">
          <span className="font-semibold">Sin gestores configurados.</span>{' '}
          <span className="text-muted-foreground">
            Nadie puede recibir prospectos en este proyecto hasta que se asigne alguien.
          </span>
        </div>
      </div>
    );
  }

  const gestores = estado?.gestores || [];
  const siguiente = estado?.next_gestor || null;

  // Gestora: se enseña el turno configurado, pero NO se afirma quién es el
  // siguiente. Con su sesión no hay forma de comprobar si esa cola manda de
  // verdad, y un «te toca a ti» equivocado es peor que no decir nada.
  if (salud === 'sin_verificar') {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Turno configurado</span>
          {gestores.map((g) => (
            <span
              key={g.id}
              title={g.nombre}
              className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full text-[10px] text-muted-foreground"
            >
              <Avatar gestor={g} />
              <span className="truncate max-w-[110px]">{g.nombre}</span>
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-auto">
            La cola se movió {desdeHace(estado?.last_assigned_at ?? null)}
          </span>
        </div>
      </div>
    );
  }

  if (salud === 'congelada') {
    return (
      <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <WarningCircle size={16} weight="duotone" className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              El reparto de este proyecto no lo hace el CRM
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
              Han entrado <strong>{posteriores} prospecto{posteriores !== 1 ? 's' : ''}</strong> desde que
              la cola se movió por última vez ({desdeHace(estado?.last_assigned_at ?? null)}). Quien
              asigna es el sistema que los trae —hoy, Make—, así que aquí no hay un «siguiente» que
              enseñar.
            </p>
            <p className="text-[11px] text-amber-800/70 dark:text-amber-300/70 mt-1.5">
              La cola sigue ahí para lo que sí usa el CRM: repartir los prospectos que se quedan sin
              responsable.
            </p>
          </div>
          {esAdmin && (
            <button
              onClick={repartir}
              disabled={repartiendo}
              className="h-8 px-3 rounded-md border border-amber-400 dark:border-amber-700 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
            >
              {repartiendo ? '…' : 'Repartir sin asignar'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Cola viva: el turno de verdad.
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Próximo prospecto</span>
          <ArrowRight size={12} weight="bold" className="text-muted-foreground flex-shrink-0" />
          {siguiente ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <Avatar gestor={siguiente} destacado />
              <span className="text-[13px] font-semibold truncate">{siguiente.nombre}</span>
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">—</span>
          )}
        </div>

        {estado?.last_gestor && (
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            Último: <span className="text-foreground">{estado.last_gestor.nombre}</span>
            {' · '}{desdeHace(estado.last_assigned_at)}
          </span>
        )}

        {esAdmin && (
          <button
            onClick={repartir}
            disabled={repartiendo}
            title="Reparte por turno los prospectos que se quedaron sin responsable"
            className="h-8 px-3 rounded-md border border-border text-[11px] font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap ml-auto"
          >
            {repartiendo ? '…' : 'Repartir sin asignar'}
          </button>
        )}
      </div>

      {gestores.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-border">
          <span className="text-[10px] text-muted-foreground mr-0.5">Orden:</span>
          {gestores.map((g) => {
            const esSiguiente = g.id === siguiente?.id;
            return (
              <span
                key={g.id}
                title={g.nombre}
                className={`inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full text-[10px] ${
                  esSiguiente
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                <Avatar gestor={g} />
                <span className="truncate max-w-[110px]">{g.nombre}</span>
              </span>
            );
          })}
          <span className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-1 ml-1">
            <Info size={10} />
            se actualiza solo
          </span>
        </div>
      )}
    </div>
  );
}
