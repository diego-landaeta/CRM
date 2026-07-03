import { cn } from '@/shared/lib/utils';

// Paleta de tonos del sistema de diseño (icono en tile de color).
// Token-based friendly: se ve bien en claro (testeo/SuiteDash) y oscuro (prod).
export const TILE_TONES = {
  cyan: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
  slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-400',
};

/**
 * StatTile — tile de métrica del sistema de diseño (estilo SuiteDash/Zoho).
 * icono en cuadrado de color + label en mayúscula + valor grande + hint/delta.
 * Si recibe `onClick`, se renderiza como botón con hover elevado.
 */
export default function StatTile({
  icon: Icon,
  tone = 'cyan',
  label,
  value,
  hint = null,
  delta = null,
  onClick = null,
  className = '',
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group w-full text-left bg-card border border-border rounded-xl p-4 sm:p-5 transition-all duration-150',
        onClick && 'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_22px_-8px_rgb(15_23_42_/_0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', TILE_TONES[tone] || TILE_TONES.cyan)}>
          {Icon && <Icon size={20} weight="duotone" />}
        </span>
        {delta != null && (
          <span className={cn(
            'text-[11px] font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md',
            delta >= 0 ? 'text-emerald-600 bg-emerald-500/12 dark:text-emerald-400' : 'text-rose-600 bg-rose-500/12 dark:text-rose-400',
          )}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums mt-1 leading-none tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{hint}</p>}
    </Comp>
  );
}
