import { NavLink } from 'react-router-dom';
import {
  SquaresFour,
  Users,
  Package,
  Megaphone,
  CurrencyEur,
  ChartLineUp,
  Gear,
  SignOut,
  CaretDown,
  Moon,
  Sun,
} from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/shared/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'Productos', to: '/products', icon: Package },
  { label: 'Campanas', to: '/campaigns', icon: Megaphone },
  { label: 'Ingresos', to: '/revenue', icon: CurrencyEur },
  { label: 'Reportes', to: '/reports', icon: ChartLineUp },
];

const SYSTEM_ITEMS = [
  { label: 'Configuracion', to: '/settings', icon: Gear },
];

function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all',
          isActive
            ? 'bg-secondary text-foreground font-bold'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )
      }
    >
      <Icon size={18} weight="regular" />
      {label}
      {badge && (
        <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { activeProject, switchProject, projects } = useProjectContext();
  const { theme, toggleTheme } = useTheme();

  const initials = user?.nombre?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const rolLabel = { superadmin: 'Superadmin', admin: 'Admin', gestor: 'Gestor' }[user?.role] || '';

  return (
    <aside className="w-64 border-r bg-card h-screen fixed left-0 top-0 flex flex-col p-4 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
          <Package size={16} weight="bold" />
        </div>
        <span className="font-extrabold text-sm tracking-tight text-foreground">MultiCRM</span>
      </div>

      {/* Project Selector */}
      <div className="mb-6 px-1">
        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-1.5 block">
          Proyecto
        </label>
        <div className="relative">
          <select
            value={activeProject.id}
            onChange={(e) => switchProject(Number(e.target.value))}
            className="w-full h-9 px-3 pr-8 rounded-lg border border-border text-sm font-semibold bg-secondary text-foreground outline-none cursor-pointer appearance-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <CaretDown size={12} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">Principal</p>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 mt-6">Sistema</p>
        {SYSTEM_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Footer: Theme + User */}
      <div className="mt-auto pt-4 border-t border-border space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
        >
          {theme === 'dark' ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate tracking-tight">{user?.nombre}</p>
            <p className="text-[10px] text-muted-foreground">{rolLabel}</p>
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Cerrar sesion">
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
