import { cn } from '@/shared/lib/utils';
import type { CampusMoodle, FiltroEstado } from '../api/moodle.api';

/**
 * Los cursos de un campus por su estado, como un selector con el recuento de cada uno:
 * «Activos 134 · Próximos 1 · Terminados 2 · Ocultos 3 · Todos 140». Se ve de un vistazo
 * cuántos hay de cada y se cambia con un clic.
 */
const OPCIONES: { clave: FiltroEstado; etiqueta: string; cuenta: (c: NonNullable<CampusMoodle['cursos']>) => number }[] = [
  { clave: 'activos', etiqueta: 'Activos', cuenta: (c) => c.activos },
  { clave: 'proximos', etiqueta: 'Próximos', cuenta: (c) => c.proximos },
  { clave: 'terminados', etiqueta: 'Terminados', cuenta: (c) => c.terminados },
  { clave: 'ocultos', etiqueta: 'Ocultos', cuenta: (c) => c.ocultos },
  { clave: 'todos', etiqueta: 'Todos', cuenta: (c) => c.total },
];

export default function EstadoDeCursos({ valor, cursos, onChange }: {
  valor: FiltroEstado;
  cursos: CampusMoodle['cursos'];
  onChange: (estado: FiltroEstado) => void;
}) {
  return (
    <div role="tablist" aria-label="Estado de los cursos" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" data-testid="estado-cursos">
      {OPCIONES.map((o) => {
        const activa = o.clave === valor;
        return (
          <button
            key={o.clave}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(o.clave)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40',
              activa ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.etiqueta}
            {cursos && <span className={cn('tabular-nums text-xs', activa ? 'text-primary' : 'text-muted-foreground')}>{o.cuenta(cursos)}</span>}
          </button>
        );
      })}
    </div>
  );
}
