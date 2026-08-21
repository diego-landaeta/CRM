import { Link } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

/**
 * PageHeader - Cabecera consistente de pagina.
 *
 * props:
 *  - title: titulo principal
 *  - subtitle: texto secundario
 *  - actions: nodo React con botones a la derecha
 *  - breadcrumbs: nodo opcional arriba del titulo
 *  - backTo: ruta del sitio del que se viene. Pinta el enlace de volver.
 *  - backLabel: como se llama ese sitio (por defecto, "Volver")
 *
 * El enlace de volver vive aqui y no en cada pagina a proposito: sale siempre
 * en el mismo punto —encima del titulo, a la izquierda— y no hay que acordarse
 * de ponerlo. Entrar a Roles o a Campos y no tener mas salida que el boton del
 * navegador desorienta, sobre todo en una pantalla con submenu lateral.
 */
export default function PageHeader({
  title,
  subtitle = null,
  actions = null,
  breadcrumbs = null,
  backTo = null,
  backLabel = 'Volver',
  className = '',
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 -ml-1 mb-1 px-1 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <CaretLeft size={12} weight="bold" />
            {backLabel}
          </Link>
        )}
        {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
        <h1 className="text-xl font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground text-sm mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
