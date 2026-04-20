import { cn } from '@/shared/lib/utils';

/**
 * EmptyState - Estado vacio reutilizable con direccion.
 *
 * props:
 *  - icon: componente Phosphor
 *  - title: titulo del estado vacio
 *  - description: texto secundario
 *  - action: nodo opcional (boton o link)
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon size={32} weight="duotone" className="text-muted-foreground" />
        </div>
      )}
      {title && <h3 className="font-semibold text-foreground mb-1">{title}</h3>}
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
