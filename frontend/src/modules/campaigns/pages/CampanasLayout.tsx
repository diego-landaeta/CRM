import { Outlet } from 'react-router-dom';
import { Megaphone, ChartBar, MetaLogo, GoogleLogo, Globe } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';

const TABS = [
  { label: 'Consolidado', to: '/campanas', icon: ChartBar },
  { label: 'Meta Ads', to: '/campanas/meta', icon: MetaLogo },
  { label: 'Google Ads', to: '/campanas/google', icon: GoogleLogo },
  { label: 'Tráfico orgánico', to: '/campanas/seo', icon: Globe },
];

export default function CampanasLayout() {
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={TABS} sectionLabel="Campañas" sectionIcon={Megaphone} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
