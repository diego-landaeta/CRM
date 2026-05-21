import { Info } from '@phosphor-icons/react';

interface Props {
  feature?: string;
  className?: string;
}

// Cuando el usuario tiene seleccionado "Todos los proyectos" pero está en una
// sección que sólo tiene sentido para un proyecto concreto (catálogo, configuración,
// documentos…), mostramos esta tarjeta en lugar de la pantalla vacía/errores.
export default function NeedsProjectBanner({ feature = 'esta sección', className = '' }: Props) {
  return (
    <div className={`bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-6 text-center ${className}`}>
      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 mx-auto mb-3 flex items-center justify-center">
        <Info size={20} weight="regular" />
      </div>
      <p className="text-sm font-semibold mb-1">Selecciona un proyecto</p>
      <p className="text-xs text-muted-foreground">
        Tienes activa la vista <strong>Todos los proyectos</strong>. {feature.charAt(0).toUpperCase() + feature.slice(1)} se gestiona por proyecto:
        elige uno desde el selector de la barra lateral para continuar.
      </p>
    </div>
  );
}
