import { Outlet } from 'react-router-dom';
import { Bank, Lightning, ListBullets, UserPlus, WebhooksLogo } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';
import { useProjectContext } from '@/contexts/ProjectContext';

/*
  Conexión › Webhooks (#690): un solo apartado para todos. El Resumen los reúne
  por función; las otras pestañas son las pantallas de siempre, que estaban
  sueltas en Captación (Webhooks y Make) y en Conexión (transferencias). Sus
  direcciones viejas redirigen aquí (App.jsx). SubNav esconde la pestaña que no
  se puede abrir, con el permiso de `SIN_ENTRADA` en el Sidebar.

  `module`: el módulo del campus que tenían sus entradas del menú. Con él
  apagado en el campus de arriba, la pestaña no sale, como no salía la entrada.
*/
export const TABS = [
  { label: 'Resumen', to: '/conexion/webhooks', icon: ListBullets },
  { label: 'Prospectos', to: '/conexion/webhooks/prospectos', icon: UserPlus, end: false, module: 'webhooks' },
  { label: 'Make', to: '/conexion/webhooks/make', icon: Lightning, end: false, module: 'make' },
  { label: 'Transferencias', to: '/conexion/webhooks/transferencias', icon: Bank },
];

/** Las pestañas que salen con los módulos de este campus (`false`: apagado). */
export function pestanasDe(modules?: Record<string, boolean> | null) {
  return TABS.filter((t) => !t.module || modules?.[t.module] !== false);
}

export default function WebhooksLayout() {
  const { activeProject } = useProjectContext() as { activeProject: { modules?: Record<string, boolean> | null } | null };
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={pestanasDe(activeProject?.modules)} sectionLabel="Webhooks" sectionIcon={WebhooksLogo} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
