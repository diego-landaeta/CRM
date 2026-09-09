import { UsersThree, UserMinus, Clock, CheckCircle } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

/**
 * Las cuatro cifras de la pantalla, en una fila a todo lo ancho.
 *
 * Estaban dentro del bloque «Salud comercial», y al pasar ese bloque a una de
 * las tres columnas se quedaron sin sitio: las etiquetas salían cortadas
 * —«Pr…», «Si…»— y el detalle en cinco líneas. En la maqueta son una fila
 * propia por encima de las columnas, y es por esto.
 */

type Tono = 'neutro' | 'aviso' | 'peligro' | 'bien';

const TONOS: Record<Tono, string> = {
  neutro: 'bg-muted text-muted-foreground',
  aviso: 'bg-warning-soft text-warning-soft-foreground',
  peligro: 'bg-destructive-soft text-destructive-soft-foreground',
  bien: 'bg-success-soft text-success-soft-foreground',
};

function Cifra({
  icon: Icon, etiqueta, valor, detalle, tono = 'neutro', onClick, activo,
}: {
  icon: any; etiqueta: string; valor: number; detalle: string;
  tono?: Tono; onClick?: () => void; activo?: boolean;
}) {
  // Las que filtran son botones de verdad; las que no, no lo fingen. Un número
  // que parece pulsable y no hace nada es peor que uno quieto.
  const Elemento = onClick ? 'button' : 'div';
  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors',
        onClick && 'hover:border-muted-foreground/40 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/40',
        activo && 'border-primary/50 bg-primary/5',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', TONOS[tono])}>
        <Icon size={17} weight="regular" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-secundario text-muted-foreground">{etiqueta}</span>
        <span className="block text-cifra tabular-nums leading-none">{valor}</span>
        <span className="mt-1 block text-secundario text-muted-foreground">{detalle}</span>
      </span>
    </Elemento>
  );
}

interface Stats {
  total?: number;
  convertido?: number;
  sin_asignar?: number;
}

interface Urgencias {
  overdue: number;
  today: number;
  urgent: number;
}

export default function CifrasProspectos({
  stats, urgencias, filtroRapido, onFiltroRapido,
}: {
  stats: Stats;
  urgencias: Urgencias;
  filtroRapido?: string | null;
  onFiltroRapido?: (clave: string | null) => void;
}) {
  const total = stats.total ?? 0;
  if (total === 0) return null;

  const sinAsignar = stats.sin_asignar ?? 0;
  const convertidos = stats.convertido ?? 0;
  const alternar = (clave: string) => onFiltroRapido?.(filtroRapido === clave ? null : clave);

  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Cifra
        icon={UsersThree}
        etiqueta="Prospectos"
        valor={total}
        detalle="con los filtros puestos"
      />
      <Cifra
        icon={UserMinus}
        etiqueta="Sin asignar"
        valor={sinAsignar}
        detalle={sinAsignar > 0 ? 'no los trabaja nadie' : 'todos tienen gestora'}
        tono={sinAsignar > 0 ? 'aviso' : 'bien'}
      />
      <Cifra
        icon={Clock}
        etiqueta="Piden atención"
        valor={urgencias.urgent}
        detalle={`${urgencias.overdue} vencidos · ${urgencias.today} para hoy`}
        tono={urgencias.urgent > 0 ? 'peligro' : 'bien'}
        activo={filtroRapido === 'urgent'}
        onClick={onFiltroRapido ? () => alternar('urgent') : undefined}
      />
      <Cifra
        icon={CheckCircle}
        etiqueta="Convertidos"
        valor={convertidos}
        detalle={`${Math.round((convertidos / total) * 100)}% de los visibles`}
        tono="bien"
      />
    </section>
  );
}
