import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  CaretRight,
  Moon,
  Sun,
  ShieldCheck,
  Calculator,
  Receipt,
  UserCheck,
  Coins,
} from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/shared/lib/utils';
import { lazy, Suspense } from 'react';

const ProjectSettingsDialog = lazy(() => import('@/modules/settings/components/ProjectSettingsDialog'));

// Cada item declara los roles que pueden verlo (omitir = todos)
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'Clientes', to: '/clients', icon: UserCheck },
  { label: 'Productos', to: '/products', icon: Package, roles: ['superadmin', 'admin'] },
  { label: 'Campanas', to: '/campaigns', icon: Megaphone, roles: ['superadmin', 'admin'] },
  {
    label: 'Contabilidad', icon: Calculator,
    children: [
      { label: 'Dashboard', to: '/accounting', roles: ['superadmin', 'admin'] },
      { label: 'Ingresos', to: '/accounting/income', roles: ['superadmin', 'admin'] },
      { label: 'Egresos', to: '/accounting/expenses', roles: ['superadmin', 'admin'] },
      { label: 'Cuentas por cobrar', to: '/accounting/receivable', roles: ['superadmin', 'admin'] },
      { label: 'Cuentas por pagar', to: '/accounting/payable', roles: ['superadmin', 'admin'] },
      { label: 'Comisiones', to: '/commissions' },
    ],
  },
  { label: 'Reportes', to: '/reports', icon: ChartLineUp, roles: ['superadmin', 'admin'] },
];

function canSeeItem(item, role) {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function NavGroup({ icon: Icon, label, children, role, onNavigate }) {
  const visible = children.filter((c) => !c.roles || c.roles.includes(role));
  const location = useLocation();
  const hasActiveChild = visible.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));
  const [open, setOpen] = useState(hasActiveChild);
  if (!visible.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all',
          hasActiveChild ? 'text-foreground font-bold' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )}
      >
        <Icon size={18} weight={hasActiveChild ? 'duotone' : 'regular'} />
        {label}
        <CaretRight size={12} weight="bold" className={cn('ml-auto transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 pl-4 border-l border-border space-y-0.5">
          {visible.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.to === '/accounting'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-1.5 rounded-lg text-[12px] transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all',
          isActive
            ? 'bg-primary/10 text-primary font-bold shadow-sm'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
            />
          )}
          <Icon size={18} weight={isActive ? 'duotone' : 'regular'} />
          {label}
          {badge && (
            <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeProject, switchProject, projects } = useProjectContext();
  const { theme, toggleTheme } = useTheme();
  const [configOpen, setConfigOpen] = useState(false);

  const initials = user?.nombre?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const rolLabel = { superadmin: 'Superadmin', admin: 'Admin', gestor: 'Gestor' }[user?.role] || '';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside role="navigation" aria-label="Menu principal" className="w-64 border-r bg-card h-screen fixed left-0 top-0 flex flex-col p-4 z-40">
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
        <div className="flex items-center gap-2">
          {activeProject?.logo_url ? (
            <img
              src={`${(import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '')}/api/projects/${activeProject.id}/logo`}
              alt=""
              className="w-8 h-8 rounded-lg object-contain bg-muted/50 flex-shrink-0"
            />
          ) : activeProject?.emoji ? (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
              {activeProject.emoji}
            </div>
          ) : null}
          <div className="relative flex-1">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => switchProject(Number(e.target.value))}
              aria-label="Selector de proyecto"
              className="w-full h-9 px-3 pr-8 rounded-lg border border-border text-sm font-semibold bg-secondary text-foreground outline-none cursor-pointer appearance-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <CaretDown size={12} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {(user?.role === 'admin' || user?.role === 'superadmin') && activeProject && (
            <button
              onClick={() => setConfigOpen(true)}
              className="w-9 h-9 rounded-lg border border-border bg-secondary hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors"
              title={`Configurar ${activeProject.nombre}`}
              aria-label="Configurar proyecto activo"
            >
              <Gear size={14} weight="bold" className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {configOpen && activeProject && (
        <Suspense fallback={null}>
          <ProjectSettingsDialog
            project={activeProject}
            onClose={() => setConfigOpen(false)}
          />
        </Suspense>
      )}

      {/* Navigation */}
      <nav className="space-y-0.5 flex-1">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">Principal</p>
        {NAV_ITEMS.filter((item) => canSeeItem(item, user?.role)).map((item) =>
          item.children ? (
            <NavGroup key={item.label} {...item} role={user?.role} onNavigate={onNavigate} />
          ) : (
            <NavItem key={item.to} {...item} onClick={onNavigate} />
          )
        )}

      </nav>

      {/* Footer: Beta Badge + Theme + User */}
      <div className="mt-auto pt-4 border-t border-border space-y-3">
        {/* Beta Badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <ShieldCheck size={14} weight="duotone" className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">v0.1.0 Fase Beta</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
        >
          {theme === 'dark' ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>

        {/* Configuracion (solo admin/superadmin) */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all',
              isActive ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            )}
          >
            <Gear size={18} weight="duotone" />
            Configuracion
          </NavLink>
        )}

        {/* User */}
        <div className="flex items-center gap-3 px-2">
          <button onClick={() => { navigate('/profile'); onNavigate?.(); }} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs hover:bg-primary/20 transition-colors" title="Mi perfil">
            {initials}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { navigate('/profile'); onNavigate?.(); }}>
            <p className="text-xs font-bold text-foreground truncate tracking-tight">{user?.nombre}</p>
            <p className="text-[10px] text-muted-foreground">{rolLabel}</p>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-red-500 transition-colors p-1" title="Cerrar sesion">
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
