import { Outlet } from 'react-router-dom';
import { Users, ListBullets, Kanban, UsersThree } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';

const TABS = [
  { label: 'Listado', to: '/prospectos', icon: ListBullets },
  { label: 'Pipeline', to: '/prospectos/pipeline', icon: Kanban },
  { label: 'Audiencias', to: '/prospectos/audiencias', icon: UsersThree },
];

export default function ProspectosLayout() {
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={TABS} sectionLabel="Prospectos" sectionIcon={Users} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
