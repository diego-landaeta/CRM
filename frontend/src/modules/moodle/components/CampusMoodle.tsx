import { CheckCircle, MinusCircle, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';
import type { CampusMoodle } from '../api/moodle.api';

/**
 * La fila de campus de arriba del panel.
 *
 *   · Los campus con Moodle conectado son pestañas, con sus cifras a la vista (cursos
 *     activos y cuántos hay). Si su Moodle no contesta, se dice: no se pinta un cero.
 *   · Los que no tienen Moodle van recogidos en un desplegable, para que no ocupen sitio
 *     donde no hay nada que ver; se pueden abrir igualmente para ver cómo se conectan.
 */
export default function CampusMoodleTabs({ campus, elegido, onElegir }: {
  campus: CampusMoodle[];
  elegido: number | null;
  onElegir: (id: number) => void;
}) {
  const conectados = campus.filter((c) => c.configurado);
  const sinConectar = campus.filter((c) => !c.configurado);
  const elegidoSinConectar = sinConectar.some((c) => c.id === elegido);

  return (
    <div className="space-y-2">
      {conectados.length > 0 && (
        <div role="tablist" aria-label="Campus con Moodle" className="flex flex-wrap gap-2" data-testid="campus-moodle">
          {conectados.map((c) => {
            const activo = c.id === elegido;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => onElegir(c.id)}
                className={cn(
                  'min-w-[11rem] rounded-lg border px-3.5 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40',
                  activo ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {c.error ? <WarningCircle size={15} weight="fill" className="text-warning" /> : <CheckCircle size={15} weight="fill" className="text-success" />}
                  {c.nombre}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {c.error ? 'Su Moodle no responde' : c.cursos ? `${c.cursos.activos} activos · ${c.cursos.total} cursos` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sinConectar.length > 0 && (
        <details className="text-xs text-muted-foreground" open={elegidoSinConectar} data-testid="campus-moodle-sin-conectar">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1.5">
            <MinusCircle size={14} />
            {conectados.length === 0 ? `${sinConectar.length} campus, ninguno con Moodle conectado` : `${sinConectar.length} campus sin Moodle conectado`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinConectar.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onElegir(c.id)}
                aria-pressed={c.id === elegido}
                className={cn(
                  'rounded-full border px-2.5 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40',
                  c.id === elegido ? 'border-primary text-foreground' : 'border-border',
                )}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
