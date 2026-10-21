import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import StatusDot from '@/shared/components/ui/StatusDot';
import type { CursoMoodle } from '../api/moodle.api';
import { ESTADO_DEL_CURSO, fecha } from '../lib/formato';

/** Los cursos de un campus. Pulsar uno abre su detalle (alumnos, contenido y recursos). */
export default function TablaCursos({ cursos, total, pagina, limite, elegido, onElegir, onPagina }: {
  cursos: CursoMoodle[];
  total: number;
  pagina: number;
  limite: number;
  elegido: number | null;
  onElegir: (curso: CursoMoodle) => void;
  onPagina: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  const desde = total ? (pagina - 1) * limite + 1 : 0;
  const hasta = Math.min(total, pagina * limite);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="tabla-cursos">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-semibold">Curso</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Categoría</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Alumnos</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Inicio</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Fin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cursos.map((c) => {
              const e = ESTADO_DEL_CURSO[c.estado];
              return (
                <tr key={c.curso_id} className={c.curso_id === elegido ? 'bg-primary/5' : 'hover:bg-muted/40'}>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onElegir(c)}
                      className="text-left font-medium text-foreground hover:text-primary focus:outline-none focus-visible:underline"
                    >
                      {c.nombre.trim()}
                    </button>
                    {c.nombre_corto && <span className="ml-2 text-xs text-muted-foreground">{c.nombre_corto}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.categoria ?? '—'}</td>
                  <td className="px-4 py-2.5"><StatusDot tono={e.tono} title={e.ayuda}>{e.etiqueta}</StatusDot></td>
                  <td className="px-4 py-2.5 text-right tabular-nums" title={c.alumnos_error}>
                    {c.alumnos === null ? <span className="text-warning" aria-label="No se pudo leer">?</span> : c.alumnos}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fecha(c.inicio)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fecha(c.fin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>{total ? `${desde}–${hasta} de ${total}` : 'Sin resultados'}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={pagina <= 1}
            onClick={() => onPagina(pagina - 1)}
            className="rounded p-1.5 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <span className="px-1 tabular-nums">Página {pagina} de {paginas}</span>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={pagina >= paginas}
            onClick={() => onPagina(pagina + 1)}
            className="rounded p-1.5 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
