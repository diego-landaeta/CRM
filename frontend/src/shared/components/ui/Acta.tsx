import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

/**
 * El acta: la tira de cifras de una pantalla (rediseño, 20/11).
 *
 * Es la cabecera de campos encajados de un acta: una sola hoja, dividida en
 * celdas por costuras de 1 px, una cifra por celda. Sustituye a la fila de
 * tarjetas KPI de 140 px que empujaba la lista fuera de la primera pantalla.
 *
 * Las celdas que filtran son botones de verdad y se marcan con el cian (el
 * sello) cuando están puestas; las que no filtran no lo fingen.
 *
 * Las celdas se reparten solas: tantas columnas como quepan de `min` px, y en
 * el móvil, dos por fila. `KpiCard` y `Cifra` también sirven de celda: dentro
 * del acta pierden su borde.
 */
export function Acta({
  children, className, min = 132, etiqueta,
}: { children: ReactNode; className?: string; min?: number; etiqueta?: string }) {
  return (
    <section
      aria-label={etiqueta}
      className={cn('acta grid overflow-hidden rounded-lg border border-border bg-border gap-px', className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 45%), 1fr))` }}
    >
      {children}
    </section>
  );
}

export type TonoCampo = 'neutro' | 'aviso' | 'peligro' | 'bien' | 'info';

const TONO_CIFRA: Record<TonoCampo, string> = {
  neutro: 'text-foreground',
  aviso: 'text-warning',
  peligro: 'text-destructive',
  bien: 'text-success-soft-foreground',
  info: 'text-info-soft-foreground',
};

export function CampoActa({
  etiqueta, valor, detalle, icon: Icon, tono = 'neutro', onClick, activo, title, recorrido, ariaLabel,
}: {
  ariaLabel?: string;
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icon?: ComponentType<IconProps>;
  tono?: TonoCampo;
  onClick?: () => void;
  activo?: boolean;
  /** El valor entero, cuando la celda lo enseña abreviado. */
  title?: string;
  /** Para los recorridos guiados (`data-recorrido`). */
  recorrido?: string;
}) {
  const Elemento = onClick ? 'button' : 'div';
  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick, ...(activo !== undefined ? { 'aria-pressed': !!activo } : {}) } : {})}
      {...(recorrido ? { 'data-recorrido': recorrido } : {})}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'relative min-w-0 bg-card px-3 py-2 text-left',
        onClick && 'transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        activo && 'bg-muted ring-1 ring-inset ring-foreground/20',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon size={13} weight="regular" aria-hidden="true" className="shrink-0" />}
        <span className="truncate">{etiqueta}</span>
      </span>
      <span className={cn('block truncate text-[length:clamp(1rem,4vw,1.25rem)] font-semibold leading-7 tracking-tight tabular-nums', TONO_CIFRA[tono])}>
        {valor}
      </span>
      {detalle && <span className="block truncate text-[11px] leading-4 text-muted-foreground">{detalle}</span>}
    </Elemento>
  );
}

/**
 * Importe abreviado para una celda estrecha: «121,5 k €». El entero va en el
 * `title` de la celda. Por debajo de 10.000 se deja como viene.
 */
export function abreviarImporte(n: number, moneda = '€'): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const fmt = (v: number, d: number) => v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `${fmt(n / 1_000_000, 2)} M ${moneda}`;
  if (abs >= 10_000) return `${fmt(n / 1000, 1)} k ${moneda}`;
  return `${fmt(n, 2)} ${moneda}`;
}

export default Acta;
