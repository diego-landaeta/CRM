import { Link } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import StatusDot from '@/shared/components/ui/StatusDot';
import { cn } from '@/shared/lib/utils';
import type { CampusMoodle } from '../api/moodle.api';

/**
 * La lista de campus, una fila por campus: si tiene Moodle conectado y, si lo tiene, sus
 * cifras. Pulsar una fila entra en el campus (sus cursos). Los que no tienen Moodle salen
 * atenuados, y su pantalla explica cómo conectarlo.
 */
function Estado({ c }: { c: CampusMoodle }) {
  if (c.error) return <StatusDot tono="warning" title={c.error}>No responde</StatusDot>;
  if (c.configurado) return <StatusDot tono="success">Conectado</StatusDot>;
  return <StatusDot tono="neutral">Sin conectar</StatusDot>;
}

export default function ListaDeCampus({ campus }: { campus: CampusMoodle[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="lista-campus">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-semibold">Campus</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Moodle</th>
            <th scope="col" className="px-4 py-2.5 font-semibold text-right">Cursos activos</th>
            <th scope="col" className="px-4 py-2.5 font-semibold text-right">Cursos en total</th>
            <th scope="col" className="w-10 px-4 py-2.5"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {campus.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className={cn('px-4 py-3', !c.configurado && 'text-muted-foreground')}>
                <Link
                  to={`/conexion/moodle/${c.id}`}
                  className={cn('font-medium hover:text-primary focus:outline-none focus-visible:underline', c.configurado ? 'text-foreground' : 'text-muted-foreground')}
                >
                  {c.nombre}
                </Link>
              </td>
              <td className="px-4 py-3"><Estado c={c} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{c.cursos ? c.cursos.activos : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3 text-right tabular-nums">{c.cursos ? c.cursos.total : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                <Link to={`/conexion/moodle/${c.id}`} aria-label={`Abrir ${c.nombre}`} tabIndex={-1}><CaretRight size={14} weight="bold" /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
