import { useMemo } from 'react';
import {
  UsersThree, UserMinus, Clock, CheckCircle,
} from '@phosphor-icons/react';
import Card from '@/shared/components/ui/Card';
import { cn } from '@/shared/lib/utils';

/**
 * Salud comercial — lo que pasa con los prospectos, antes de la tabla.
 *
 * La pantalla empezaba directamente en la tabla: para saber cuántos había sin
 * asignar o cuántos avisos estaban vencidos había que filtrar y contar a ojo.
 * Los números ya venían del servidor y solo se usaban para pintar unas píldoras
 * dentro del desplegable de filtros, donde no los ve nadie.
 *
 * Sigue la maqueta de referencia (`suitedash-preview`): las cifras que se miran
 * de lejos arriba, el detalle debajo, cada bloque con título y subtítulo que
 * dicen qué es y para qué sirve, iconos del mismo grosor y ni un emoji.
 *
 * Todo va con tokens, así que funciona en claro y en oscuro sin una segunda
 * versión de cada color.
 */

interface Stats {
  total?: number;
  nuevo?: number;
  por_contactar?: number;
  contactado?: number;
  en_seguimiento?: number;
  convertido?: number;
  no_interesado?: number;
  sin_asignar?: number;
}

interface Urgencias {
  overdue: number;
  today: number;
  noContact: number;
  urgent: number;
}

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
  // Las que se pueden filtrar son botones de verdad; las que no, no fingen
  // serlo. Un número que parece pulsable y no hace nada es peor que uno quieto.
  const Elemento = onClick ? 'button' : 'div';
  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors',
        onClick && 'hover:border-muted-foreground/40 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40',
        activo && 'border-primary/50 bg-primary/5',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', TONOS[tono])}>
        <Icon size={17} weight="regular" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-secundario text-muted-foreground">{etiqueta}</span>
        <span className="block text-cifra tabular-nums leading-none">{valor}</span>
        {/* Sin `truncate`: en movil la tarjeta es estrecha y cortaba a media
            palabra («no los esta tra...»). Que envuelva; la rejilla iguala
            las alturas sola. */}
        <span className="mt-1 block text-secundario text-muted-foreground">{detalle}</span>
      </span>
    </Elemento>
  );
}

// El reparto por estado. Los nombres y el orden son los del embudo, no los de
// la base: «por contactar» va antes que «contactado» aunque alfabéticamente no.
const ESTADOS: Array<{ clave: keyof Stats; etiqueta: string; barra: string }> = [
  { clave: 'nuevo', etiqueta: 'Nuevos', barra: 'bg-info' },
  { clave: 'por_contactar', etiqueta: 'Por contactar', barra: 'bg-warning' },
  { clave: 'contactado', etiqueta: 'Contactados', barra: 'bg-primary' },
  { clave: 'en_seguimiento', etiqueta: 'En seguimiento', barra: 'bg-primary/60' },
  { clave: 'convertido', etiqueta: 'Convertidos', barra: 'bg-success' },
  { clave: 'no_interesado', etiqueta: 'No interesados', barra: 'bg-muted-foreground/40' },
];

export default function SaludComercial({
  stats, urgencias, filtroRapido, onFiltroRapido, onFiltroEstado,
}: {
  stats: Stats;
  urgencias: Urgencias;
  filtroRapido?: string | null;
  onFiltroRapido?: (clave: string | null) => void;
  onFiltroEstado?: (estado: string) => void;
}) {
  const total = stats.total ?? 0;

  const reparto = useMemo(
    () => ESTADOS.map((e) => {
      const n = stats[e.clave] ?? 0;
      return { ...e, n, pct: total > 0 ? Math.round((n / total) * 100) : 0 };
    }),
    [stats, total],
  );

  // Sin datos todavía no se pinta un bloque de ceros: ocupa sitio y no dice
  // nada. La tabla ya avisa de que no hay prospectos.
  if (total === 0) return null;

  const alternar = (clave: string) => onFiltroRapido?.(filtroRapido === clave ? null : clave);

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <h2 className="text-seccion">Salud comercial</h2>
        <p className="text-secundario text-muted-foreground">
          Cómo están repartidos los prospectos que estás viendo, y qué pide atención hoy.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra
          icon={UsersThree}
          etiqueta="Prospectos"
          valor={total}
          detalle="con los filtros puestos"
        />
        <Cifra
          icon={UserMinus}
          etiqueta="Sin asignar"
          valor={stats.sin_asignar ?? 0}
          detalle={(stats.sin_asignar ?? 0) > 0 ? 'no los está trabajando nadie' : 'todos tienen gestora'}
          tono={(stats.sin_asignar ?? 0) > 0 ? 'aviso' : 'bien'}
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
          valor={stats.convertido ?? 0}
          detalle={total > 0 ? `${Math.round(((stats.convertido ?? 0) / total) * 100)}% de los visibles` : '—'}
          tono="bien"
        />
      </div>

      <div>
        <p className="mb-2 text-tabla uppercase text-muted-foreground">Por estado</p>
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {reparto.map((e) => {
            const Fila = onFiltroEstado ? 'button' : 'div';
            return (
              <Fila
                key={String(e.clave)}
                {...(onFiltroEstado ? { type: 'button' as const, onClick: () => onFiltroEstado(String(e.clave)) } : {})}
                className={cn(
                  'min-w-0 text-left',
                  onFiltroEstado && 'rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40',
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
      </div>
    </Card>
  );
}
