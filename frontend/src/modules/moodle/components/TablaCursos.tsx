import StatusDot from '@/shared/components/ui/StatusDot';
import { cn } from '@/shared/lib/utils';
import type { CursoMoodle } from '../api/moodle.api';
import { ESTADO_DEL_CURSO, fecha } from '../lib/formato';

/**
 * Los cursos de un campus. Pulsar uno abre su detalle (alumnos, contenido y recursos).
 * Solo la tabla: la paginación va fuera, para poder ponerla arriba y abajo.
 */
const TH = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export default function TablaCursos({ cursos, elegido, onElegir }: {
  cursos: CursoMoodle[];
  elegido: number | null;
  onElegir: (curso: CursoMoodle) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="tabla-cursos">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th scope="col" className={TH}>Curso</th>
            <th scope="col" className={TH}>Categoría</th>
            <th scope="col" className={TH}>Estado</th>
            <th scope="col" className={cn(TH, 'text-right')}>Alumnos</th>
            <th scope="col" className={TH}>Inicio</th>
            <th scope="col" className={TH}>Fin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cursos.map((c) => {
            const e = ESTADO_DEL_CURSO[c.estado];
            return (
              <tr key={c.curso_id} className={cn('transition-colors', c.curso_id === elegido ? 'bg-primary/5' : 'hover:bg-muted/40')}>
                <td className="max-w-[28rem] px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => onElegir(c)}
                    className="block text-left font-medium leading-snug text-foreground hover:text-primary focus:outline-none focus-visible:underline"
                  >
                    {c.nombre.trim()}
                  </button>
                  {c.nombre_corto && <span className="mt-0.5 block text-xs text-muted-foreground">{c.nombre_corto}</span>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{c.categoria ?? '—'}</td>
                <td className="px-5 py-3.5"><div className="flex items-center"><StatusDot tono={e.tono} title={e.ayuda}>{e.etiqueta}</StatusDot></div></td>
                <td className="px-5 py-3.5 text-right tabular-nums" title={c.alumnos_error}>
                  {c.alumnos === null ? <span className="text-warning" aria-label="No se pudo leer">?</span> : c.alumnos}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-muted-foreground">{fecha(c.inicio)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-muted-foreground">{fecha(c.fin)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
