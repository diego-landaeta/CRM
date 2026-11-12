import { Outlet } from 'react-router-dom';
import { WebhooksLogo } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProyectosDelAmbito } from '@/shared/hooks/useAmbito';
import { TODOS_LOS_PROYECTOS } from '@/shared/lib/ambitoInforme';
import { tipoDelMenu } from '@/shared/lib/proyectosIA';
import { pestanasDe } from '../lib/pestanas';

/*
  Conexión › Webhooks (#690): un solo apartado para todos. El Resumen los reúne
  por función; las otras pestañas son las pantallas de siempre, que estaban
  sueltas en Captación (Webhooks y Make) y en Conexión (transferencias). Sus
  direcciones viejas redirigen aquí (App.jsx). SubNav esconde la pestaña que no
  se puede abrir, con el permiso de `SIN_ENTRADA` en el Sidebar; las pestañas y
  su módulo, en ../lib/pestanas.
*/
export default function WebhooksLayout() {
  const { activeProject, activeIssuerId } = useProjectContext() as {
    activeProject: { id?: number | null; modules?: Record<string, boolean> | null; type?: string | null } | null;
    activeIssuerId: number | null;
  };
  // El tipo para las pestañas: el del campus elegido; con una empresa o «Todos»,
  // IA solo si lo son TODOS sus campus (si no, alguno tiene Captación). Igual
  // que las tarjetas del Resumen, que miran campus a campus.
  const delAmbito = useProyectosDelAmbito<{ id: number; nombre: string; type?: string | null }>();
  const unCampus = !activeIssuerId && activeProject?.id && activeProject.id !== TODOS_LOS_PROYECTOS;
  const tipo = unCampus ? tipoDelMenu(activeProject?.type)
    : (delAmbito.length > 0 && delAmbito.every((c) => tipoDelMenu(c.type) === 'ia') ? 'ia' : undefined);
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={pestanasDe(activeProject?.modules, tipo)} sectionLabel="Webhooks" sectionIcon={WebhooksLogo} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
