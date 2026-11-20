import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';
import useCountUp from '@/shared/hooks/useCountUp';

/**
 * KpiCard — una cifra con su etiqueta.
 *
 * Desde el rediseño (20/11) es un CAMPO DEL ACTA, no una tarjeta: etiqueta de
 * 12 px con su icono pequeño al lado, la cifra debajo y nada más. Medía 140 px
 * (icono en caja de 36, etiqueta, cifra de 28 px y 20 de relleno); ahora 62.
 * Dentro de `<Acta>` pierde su borde y comparte la costura con las vecinas.
 *
 * La cifra no se corta en el móvil: baja de tamaño con el ancho y, si aun así
 * no cabe, se recorta con «…» y el valor entero queda en `title` (auditoría
 * del 20/11: «10.230,00 €» se salía de su caja a 375 px).
 *
 * props:
 *  - icon: Componente Phosphor
 *  - iconBg: clase de fondo y color del icono (una chapa de 20 px)
 *  - label, value, numericValue, format, badge, badgeColor, trend
 */
function AnimatedValue({ numericValue, format }) {
  const animated = useCountUp(numericValue);
  return <>{format ? format(animated) : Math.round(animated)}</>;
}

export default function KpiCard({
  icon: Icon,
  iconBg = 'bg-primary/10 text-primary',
  label,
  value = null,
  numericValue = undefined,
  format = null,
  badge = null,
  badgeColor = 'bg-success-soft text-success-soft-foreground',
  trend = 'up',
  className = '',
  tone: _tone = null,
}) {
  const TrendIcon = trend === 'up' ? TrendUp : TrendDown;
  const showBadge = badge && badge !== '--';
  const useAnimation = typeof numericValue === 'number' && Number.isFinite(numericValue);
  const titulo = typeof value === 'string' || typeof value === 'number' ? `${label}: ${value}` : undefined;
  return (
    <div
      className={cn('campo-acta min-w-0 rounded-lg border border-border bg-card px-3 py-2.5', className)}
      title={titulo}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon && (
          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', iconBg)} aria-hidden="true">
            <Icon size={12} weight="regular" />
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</p>
        {showBadge && (
          <span className={cn('inline-flex h-4 shrink-0 items-center gap-0.5 rounded px-1 text-[10px] font-medium leading-none', badgeColor)}>
            <TrendIcon size={10} weight="bold" aria-hidden="true" />
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[length:clamp(1rem,4.2vw,1.25rem)] font-semibold leading-7 tracking-tight tabular-nums">
        {useAnimation ? <AnimatedValue numericValue={numericValue} format={format} /> : value}
      </p>
    </div>
  );
}
