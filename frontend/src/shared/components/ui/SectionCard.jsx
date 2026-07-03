import { cn } from '@/shared/lib/utils';
import { TILE_TONES } from './StatTile';

/**
 * SectionCard — contenedor de sección del sistema de diseño (estilo SuiteDash/Zoho).
 * Cabecera con icono en tile de color + título + subtítulo + acción opcional,
 * y cuerpo con padding. Unifica el aspecto de todos los bloques de la app.
 */
export default function SectionCard({
  icon: Icon,
  tone = 'cyan',
  title,
  subtitle = null,
  action = null,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}) {
  return (
    <section className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
      {(title || Icon || action) && (
        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          {Icon && (
            <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', TILE_TONES[tone] || TILE_TONES.cyan)}>
              <Icon size={18} weight="duotone" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && <h3 className="font-bold text-sm leading-tight truncate">{title}</h3>}
            {subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(!noPadding && 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
