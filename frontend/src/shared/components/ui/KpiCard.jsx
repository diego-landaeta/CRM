import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

/**
 * KpiCard - Tarjeta de KPI reutilizable.
 *
 * props:
 *  - icon: Componente Phosphor
 *  - iconBg: clase Tailwind con bg + text para el cuadrado del icono
 *  - label: etiqueta superior
 *  - value: valor grande
 *  - badge: texto en badge de tendencia (opcional)
 *  - badgeColor: clases Tailwind para el badge
 *  - trend: 'up' | 'down'
 */
export default function KpiCard({
  icon: Icon,
  iconBg = 'bg-primary/10 text-primary',
  label,
  value,
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  trend = 'up',
  className,
}) {
  const TrendIcon = trend === 'up' ? TrendUp : TrendDown;
  const showBadge = badge && badge !== '--';
  return (
    <div
      className={cn(
        'bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:shadow-md transition-shadow',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        {Icon && (
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon size={20} weight="duotone" />
          </div>
        )}
        {showBadge && (
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1',
              badgeColor,
            )}
          >
            <TrendIcon size={12} weight="bold" />
            {badge}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">{label}</p>
      <h3 className="text-3xl font-extrabold mt-1 tracking-tight tabular-nums">{value}</h3>
    </div>
  );
}
