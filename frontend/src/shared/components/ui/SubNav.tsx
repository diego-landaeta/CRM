import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';

interface Tab {
  label: string;
  to: string;
  icon?: any;
}

interface Props {
  tabs: Tab[];
  sectionLabel?: string;
  sectionIcon?: any;
}

export default function SubNav({ tabs, sectionLabel, sectionIcon: Icon }: Props) {
  return (
    <nav className="flex items-center gap-1 px-5 py-2 border-b border-border overflow-x-auto">
      {sectionLabel && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide mr-3 flex-shrink-0">
          {Icon && <Icon size={14} weight="bold" />}
          {sectionLabel}
        </span>
      )}
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          {tab.icon && <tab.icon size={13} weight="bold" />}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
