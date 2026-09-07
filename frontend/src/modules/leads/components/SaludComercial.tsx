import { useMemo } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import Card from '@/shared/components/ui/Card';
import { cn } from '@/shared/lib/utils';

/**
 * Cómo están repartidos los prospectos por estado.
 *
 * La pantalla empezaba directamente en la tabla, y estos números ya venían del
 * servidor: solo se usaban para unas píldoras dentro del desplegable de
 * filtros, donde no los ve nadie.
 *
 * Las cuatro cifras grandes vivían aquí y se han ido a `CifrasProspectos`: al
 * pasar este bloque a una de las tres columnas se quedaron sin sitio y las
 * etiquetas salían cortadas. En la maqueta son una fila propia por encima.
 */

interface Stats {
  total?: number;
  nuevo?: number;
  por_contactar?: number;
  contactado?: number;
  en_seguimiento?: number;
  convertido?: number;
  no_interesado?: number;
}

// El orden es el del embudo, no el alfabético: «por contactar» va antes que
// «contactado» aunque la letra diga lo contrario.
const ESTADOS: Array<{ clave: keyof Stats; etiqueta: string; barra: string }> = [
  { clave: 'nuevo', etiqueta: 'Nuevos', barra: 'bg-info' },
  { clave: 'por_contactar', etiqueta: 'Por contactar', barra: 'bg-warning' },
  { clave: 'contactado', etiqueta: 'Contactados', barra: 'bg-muted-foreground/50' },
  { clave: 'en_seguimiento', etiqueta: 'En seguimiento', barra: 'bg-warning' },
  { clave: 'convertido', etiqueta: 'Convertidos', barra: 'bg-success' },
  { clave: 'no_interesado', etiqueta: 'No interesados', barra: 'bg-destructive' },
];

export default function SaludComercial({
  stats, onFiltroEstado, onVerPipeline,
}: {
  stats: Stats;
  onFiltroEstado?: (estado: string) => void;
  onVerPipeline?: () => void;
}) {
  const total = stats.total ?? 0;

  const reparto = useMemo(
    () => ESTADOS.map((e) => {
      const n = stats[e.clave] ?? 0;
      return { ...e, n, pct: total > 0 ? Math.round((n / total) * 100) : 0 };
    }),
    [stats, total],
  );

  // Sin datos no se pinta un bloque de ceros: ocupa sitio y no dice nada. La
  // tabla ya avisa de que no hay prospectos.
  if (total === 0) return null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-seccion">Salud comercial</h2>
          <p className="text-secundario text-muted-foreground">
            Cómo están repartidos los prospectos que estás viendo.
          </p>
        </div>
        {onVerPipeline && (
          <button
            type="button"
            onClick={onVerPipeline}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-secundario font-semibold hover:bg-muted"
          >
            Pipeline <ArrowRight size={12} weight="bold" />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {reparto.map((e) => {
          const Fila = onFiltroEstado ? 'button' : 'div';
          return (
            <Fila
              key={String(e.clave)}
              {...(onFiltroEstado ? { type: 'button' as const, onClick: () => onFiltroEstado(String(e.clave)) } : {})}
              className={cn(
                'block w-full min-w-0 text-left',
                onFiltroEstado && 'rounded-md focus:outline-none focus:ring-2 focus:ring-ring/40',
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-secundario">{e.etiqueta}</span>
                <span className="shrink-0 text-secundario tabular-nums text-muted-foreground">
                  {e.n} · {e.pct}%
                </span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', e.barra)} style={{ width: `${e.pct}%` }} />
              </span>
            </Fila>
          );
        })}
      </div>
    </Card>
  );
}
