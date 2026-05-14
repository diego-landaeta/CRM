import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowSquareOut } from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import { TABS } from '../components/settings/shared';
import UsersTab from '../components/settings/UsersTab';
import ProjectsTab from '../components/settings/ProjectsTab';
import ApisTab from '../components/settings/ApisTab';
import SecurityTab from '../components/settings/SecurityTab';
import FormsTab from '../components/settings/FormsTab';
import AvailabilityTab from '../components/settings/AvailabilityTab';

const TAB_CONTENT = {
  users: UsersTab,
  availability: AvailabilityTab,
  projects: ProjectsTab,
  forms: FormsTab,
  apis: ApisTab,
  security: SecurityTab,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('projects');
  const TabContent = TAB_CONTENT[activeTab];

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Ajustes del sistema y gestión de usuarios" />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-52 flex lg:flex-col gap-1 overflow-x-auto flex-shrink-0">
          {TABS.map((tab) => {
            if (tab.to) {
              return (
                <NavLink
                  key={tab.id}
                  to={tab.to}
                  className="w-full lg:w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] whitespace-nowrap transition-all text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <tab.icon size={16} weight="regular" />
                  <span className="flex-1">{tab.label}</span>
                  <ArrowSquareOut size={12} className="opacity-60" />
                </NavLink>
              );
            }
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full lg:w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <tab.icon size={16} weight={activeTab === tab.id ? 'duotone' : 'regular'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1">
          <TabContent />
        </div>
      </div>
    </div>
  );
}
