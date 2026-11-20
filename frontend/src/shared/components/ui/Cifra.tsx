import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

/**
 * Una cifra de cabecera: etiqueta, número y una línea que lo explica.
 *
 * Estaba dentro de `CifrasProspectos`. Sale aquí porque Clientes lleva su
 * propia fila de cuatro y tiene que ser la misma pieza: dos tarjetas de cifra
 * distintas en el mismo CRM se notan enseguida.
 *
 * OJO — ya existe `KpiCard`, que es otra tarjeta de cifra y la usan diez
 * pantallas (contabilidad, campañas, comisiones). Son dos maquetaciones
 * diferentes conviviendo, y ninguna de las dos es la de la maqueta de
 * referencia. Está anotado para decidirlo; no lo unifico por mi cuenta porque
 * afecta a pantallas que no son mías.
 */

export type TonoCifra = 'neutro' | 'aviso' | 'peligro' | 'bien';


export function Cifra({
  icon: Icon, etiqueta, valor, detalle, tono = 'neutro', onClick, activo,
}: {
  icon: ComponentType<IconProps>;
  etiqueta: string;
  /** Un número, o ya formateado (importes, porcentajes). */
  valor: number | string;
  detalle: string;
  tono?: TonoCifra;
  onClick?: () => void;
  activo?: boolean;
}) {
  // Las que filtran son botones de verdad; las que no, no lo fingen. Un número
  // que parece pulsable y no hace nada es peor que uno quieto.
  const Elemento = onClick ? 'button' : 'div';
  const TONO_CIFRA: Record<TonoCifra, string> = {
    neutro: 'text-foreground', aviso: 'text-warning', peligro: 'text-destructive', bien: 'text-success-soft-foreground',
  };
  // Rediseño (20/11): una celda del acta. Etiqueta con su icono en pequeño, la
  // cifra en su color de tono y el detalle en una línea. Dentro de
  // <FilaDeCifras> comparte la costura con las vecinas.
  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': !!activo } : {})}
      title={typeof valor === 'string' || typeof valor === 'number' ? `${etiqueta}: ${valor}` : undefined}
      className={cn(
        'campo-acta relative min-w-0 bg-card px-3 py-2 text-left',
        onClick && 'transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        activo && 'bg-muted ring-1 ring-inset ring-foreground/20',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon size={13} weight="regular" aria-hidden="true" className="shrink-0" />
        <span className="truncate">{etiqueta}</span>
      </span>
      <span className={cn('block truncate text-[length:clamp(1rem,4vw,1.25rem)] font-semibold leading-7 tracking-tight tabular-nums', TONO_CIFRA[tono])}>{valor}</span>
      <span className="block truncate text-[11px] leading-4 text-muted-foreground">{detalle}</span>
    </Elemento>
  );
}

/**
 * La fila de cifras: desde el rediseño, un acta (una hoja partida en celdas
 * por costuras de 1 px), dos por línea en el móvil y todas en una en ancho.
 */
export function FilaDeCifras({ children }: { children: React.ReactNode }) {
  return <section className="acta grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border xl:grid-cols-4">{children}</section>;
}

export default Cifra;
