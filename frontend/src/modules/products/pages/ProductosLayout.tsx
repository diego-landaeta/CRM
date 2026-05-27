import { Outlet } from 'react-router-dom';
import { Package, ListBullets, Tree, Clock, ShoppingBag } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';

const TABS = [
  { label: 'Catálogo', to: '/productos', icon: ListBullets },
  { label: 'Árbol', to: '/productos/arbol', icon: Tree },
  { label: 'Cursos pendientes', to: '/productos/pendientes', icon: Clock },
  { label: 'WooCommerce', to: '/productos/woocommerce', icon: ShoppingBag },
];

export default function ProductosLayout() {
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={TABS} sectionLabel="Productos" sectionIcon={Package} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
