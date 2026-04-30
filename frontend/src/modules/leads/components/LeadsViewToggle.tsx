import { Link } from 'react-router-dom';
import { ListBullets, Kanban } from '@phosphor-icons/react';

export default function LeadsViewToggle({ active }: { active: 'list' | 'kanban' }) {
  const baseClass = 'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors';
  const activeClass = 'bg-card text-foreground shadow-sm';
  const inactiveClass = 'text-muted-foreground hover:text-foreground';

  return (
    <div
      role="tablist"
      aria-label="Vista de prospectos"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-muted/40"
    >
      <Link
        to="/leads"
        role="tab"
        aria-selected={active === 'list'}
        className={`${baseClass} rounded-sm ${active === 'list' ? activeClass : inactiveClass}`}
      >
        <ListBullets size={14} weight="bold" />
        Lista
      </Link>
      <Link
        to="/leads/pipeline"
        role="tab"
        aria-selected={active === 'kanban'}
        className={`${baseClass} rounded-sm ${active === 'kanban' ? activeClass : inactiveClass}`}
      >
        <Kanban size={14} weight="bold" />
        Kanban
      </Link>
    </div>
  );
}
