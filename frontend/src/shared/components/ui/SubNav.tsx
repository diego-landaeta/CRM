import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import usePermission from '@/shared/hooks/usePermission';
import { rutaPermitida } from '@/shared/components/layout/Sidebar';

interface Tab {
  label: string;
  to: string;
  icon?: any;
  /** false: sigue marcada en sus subrutas (Matrículas → Certificaciones). */
  end?: boolean;
}

interface Props {
  tabs: Tab[];
  sectionLabel?: string;
  sectionIcon?: any;
}

export default function SubNav({ tabs, sectionLabel }: Props) {
  // Una pestaña que lleva a una pantalla sin permiso no se enseña (#631): con la
  // misma regla que el menú y la ruta. Antes Finanzas enseñaba a todos Nóminas,
  // Integraciones o Por cobrar, y al pulsar llegaba el 403. Sin el mapa de
  // permisos todavía, se enseñan todas (no se decide nada a medias).
  const { can } = usePermission();
  const { permissions } = useAuth() as { permissions?: Record<string, boolean> | null };
  const visibles = permissions ? tabs.filter((t) => rutaPermitida(t.to, can)) : tabs;
  return (
    <nav
      className={cn(
        // Los margenes negativos deshacen el relleno del contenido (AppLayout:
        // p-4 lg:p-6 xl:p-8). Sin esto la barra sale metida hacia dentro y su
        // borde inferior corta por la mitad de la pantalla.
        // Rediseño «papel» (20/11): una fila de 40 px pegada a la cabecera, con
        // las pestañas como texto y la activa en un fondo gris y peso medio. Sin
        // bloque cian ni subrayado: el color de la marca queda para la acción.
        // La etiqueta de sección (Prospectos, Finanzas…) ya es el título de la
        // cabecera: aquí solo la leen los lectores de pantalla.
        'mx-[calc(var(--lienzo)*-1)] -mt-[var(--lienzo)] mb-4',
        'flex h-10 items-center gap-0.5 overflow-x-auto border-b border-border',
        'bg-background px-[calc(var(--lienzo)-0.5rem)]',
      )}
      aria-label={sectionLabel}
    >
      {visibles.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end !== false}
          className={({ isActive }) =>
            cn(
              'flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] whitespace-nowrap transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )
          }
        >
          {tab.icon && <tab.icon size={15} weight="light" />}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
