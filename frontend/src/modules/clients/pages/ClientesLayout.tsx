import { Outlet } from 'react-router-dom';
import { UserCheck, ListBullets, GraduationCap } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';

const TABS = [
  { label: 'Listado', to: '/clientes', icon: ListBullets },
  { label: 'Matrículas', to: '/clientes/matriculas', icon: GraduationCap },
];

export default function ClientesLayout() {
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={TABS} sectionLabel="Clientes" sectionIcon={UserCheck} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
