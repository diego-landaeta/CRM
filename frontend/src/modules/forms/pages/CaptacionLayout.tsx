import { Outlet } from 'react-router-dom';
import { Globe, ListBullets, WebhooksLogo, Lightning } from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';

const TABS = [
  { label: 'Formularios', to: '/captacion', icon: ListBullets },
  { label: 'Webhooks', to: '/captacion/webhooks', icon: WebhooksLogo },
  { label: 'Make', to: '/captacion/make', icon: Lightning },
];

export default function CaptacionLayout() {
  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={TABS} sectionLabel="Captación" sectionIcon={Globe} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
