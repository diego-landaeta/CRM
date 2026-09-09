import { useMemo } from 'react';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import Card from '@/shared/components/ui/Card';
import { getInitials } from '@/shared/lib/ui';
import { avatarColorFor } from '@/shared/lib/ui';
import { cn } from '@/shared/lib/utils';

/**
 * Qué toca hacer ahora, en orden.
 *
 * La tabla está ordenada por fecha, que es lo correcto para buscar a alguien y
 * lo peor para empezar el día: lo urgente queda repartido por las siete
 * páginas. Esto saca los cinco primeros por urgencia y ya está — no es otra
 * tabla, es por dónde empezar.
 */

interface LeadMin {
  id: number;
  nombre?: string | null;
  next_reminder_at?: string | null;
  last_interaction_at?: string | null;
  estado?: string | null;
  responsable_nombre?: string | null;
}

// La fecha viene como texto del servidor. `new Date('2026-08-25')` la lee en
// UTC y en España eso puede ser el día anterior a las 22:00; partiendo el texto
// no hay zona horaria de por medio.
function soloFecha(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function cuando(iso?: string | null): { texto: string; urgente: boolean } {
  const f = soloFecha(iso);
  if (!f) return { texto: 'sin fecha', urgente: false };
  const hoy = new Date();
  const dias = Math.round((f.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000);
  if (dias < 0) return { texto: `vencido hace ${Math.abs(dias)}d`, urgente: true };
  if (dias === 0) return { texto: 'hoy', urgente: true };
  if (dias === 1) return { texto: 'mañana', urgente: false };
  return { texto: `en ${dias}d`, urgente: false };
}

export default function SiguientesAcciones({
  leads, onAbrir, onVerTodos,
}: {
  leads: LeadMin[];
  onAbrir?: (id: number) => void;
  onVerTodos?: () => void;
}) {
  const cola = useMemo(() => {
    const hoy = new Date();
    const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    return leads
      .filter((l) => l.next_reminder_at)
      .map((l) => ({ l, t: soloFecha(l.next_reminder_at)?.getTime() ?? Infinity }))
      // Lo más vencido primero: es lo que lleva más tiempo esperando.
      .sort((a, b) => a.t - b.t)
      .filter((x) => x.t <= corte + 7 * 86400000)
      .slice(0, 5)
      .map((x) => x.l);
  }, [leads]);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-seccion">Siguientes acciones</h2>
          <p className="text-secundario text-muted-foreground">
            Los seguimientos que tocan, del más vencido al que viene.
          </p>
        </div>
        {onVerTodos && (
          <button
            type="button"
            onClick={onVerTodos}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-secundario font-semibold hover:bg-muted"
          >
            Ver todos <ArrowRight size={12} weight="bold" />
          </button>
        )}
      </div>

      {cola.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <CheckCircle size={28} weight="duotone" className="text-success" />
          <p className="text-secundario text-muted-foreground">
            Nada pendiente en los próximos siete días.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {cola.map((l) => {
            const c = cuando(l.next_reminder_at);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onAbrir?.(l.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', avatarColorFor(l.id))}>
                    {getInitials(l.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-normal font-medium">{l.nombre || 'Sin nombre'}</span>
                    <span className="block truncate text-secundario text-muted-foreground">
                      {l.responsable_nombre || 'Sin asignar'}
                    </span>
                  </span>
                  <span className={cn('shrink-0 text-secundario font-semibold', c.urgente ? 'text-destructive' : 'text-muted-foreground')}>
                    {c.texto}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
