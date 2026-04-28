import { useState, useEffect } from 'react';
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
  MagnifyingGlass,
  Robot,
  Sparkle,
  GraduationCap,
  Envelope,
  Globe,
  ShoppingBag,
  BookOpen,
  Headset,
  ActivityIcon as Activity,
  Bell,
  FilePdf,
} from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/shared/lib/utils';
import { lazy, Suspense } from 'react';
import client from '@/shared/api/client';

const ProjectSettingsDialog = lazy(() => import('@/modules/settings/components/ProjectSettingsDialog'));

// Cada item declara: roles (omitir=todos) + module (clave en project.modules; omitir=siempre)
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Prospectos', to: '/leads', icon: Users, module: 'leads' },
  {
    label: 'Clientes', icon: UserCheck, module: 'clients',
    children: [
      { label: 'Listado', to: '/clients', module: 'clients' },
      { label: 'Matrículas', to: '/matriculas', module: 'matriculas' },
    ],
  },
  {
    label: 'Productos', icon: Package, roles: ['superadmin', 'admin'],
    children: [
      { label: 'Catálogo', to: '/products', roles: ['superadmin', 'admin'], module: 'products' },
      { label: 'WooCommerce', to: '/woocommerce', roles: ['superadmin', 'admin'], module: 'woocommerce' },
    ],
  },
  { label: 'Email seguimiento', to: '/email-sequences', icon: Envelope, roles: ['superadmin', 'admin'], module: 'email_sequences' },
  {
    label: 'Campañas', icon: Megaphone, roles: ['superadmin', 'admin'],
    children: [
      { label: 'Consolidado', to: '/campaigns', roles: ['superadmin', 'admin'] },
      { label: 'Meta Ads', to: '/campaigns/meta', roles: ['superadmin', 'admin'] },
      { label: 'Google Ads', to: '/campaigns/google', roles: ['superadmin', 'admin'] },
      { label: 'Tráfico orgánico', to: '/seo', roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Contabilidad', icon: Calculator,
    children: [
      { label: 'Dashboard', to: '/accounting', roles: ['superadmin', 'admin'], module: 'accounting_income' },
      { label: 'Ingresos', to: '/accounting/income', roles: ['superadmin', 'admin'], module: 'accounting_income' },
      { label: 'Conversiones', to: '/revenue', roles: ['superadmin', 'admin'], module: 'accounting_income' },
      { label: 'Egresos', to: '/accounting/expenses', roles: ['superadmin', 'admin'], module: 'accounting_expenses' },
      { label: 'Cuentas por cobrar', to: '/accounting/receivable', roles: ['superadmin', 'admin'], module: 'accounting_receivable' },
      { label: 'Cuentas por pagar', to: '/accounting/payable', roles: ['superadmin', 'admin'], module: 'accounting_payable' },
      { label: 'Comisiones', to: '/commissions', module: 'commissions' },
      { label: 'Nóminas', to: '/payroll', roles: ['superadmin', 'admin'], module: 'payroll' },
    ],
  },
  { label: 'Reportes', to: '/reports', icon: ChartLineUp, roles: ['superadmin', 'admin'], module: 'reports' },
  { label: 'Soporte', to: '/soporte', icon: Headset },
  { label: 'Status', to: '/status', icon: Activity },
  { label: 'Notificaciones', to: '/notificaciones', icon: Bell, roles: ['superadmin', 'admin'] },
  { label: 'Documentos', to: '/documentos', icon: FilePdf, roles: ['superadmin', 'admin'], module: 'documents' },
  { label: 'Manual de usuario', to: '/manual', icon: BookOpen },
];

function canSeeItem(item, role, modules) {
  // soporte ve todo (rol generico tipo dev)
  if (role === 'soporte' || role === 'superadmin') {
    if (item.module && modules && modules[item.module] === false) return false;
    return true;
  }
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.module && modules && modules[item.module] === false) return false;
  return true;
}

function NavGroup({ icon: Icon, label, children, role, modules, onNavigate }) {
  const visible = children.filter((c) => canSeeItem(c, role, modules));
  const location = useLocation();
  const hasActiveChild = visible.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));
  const [open, setOpen] = useState(hasActiveChild);
  if (!visible.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all',
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
          'relative flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all',
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
  const [newLeadsBadge, setNewLeadsBadge] = useState(0);

  useEffect(() => {
    if (!activeProject?.id) return;
    let cancelled = false;
    async function fetchBadge() {
      try {
        const res = await client.get(`/leads?projectId=${activeProject.id}&status=nuevo&limit=1`);
        if (!cancelled && res.success) setNewLeadsBadge(res.pagination?.total || 0);
      } catch {}
    }
    fetchBadge();
    const interval = setInterval(fetchBadge, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeProject?.id]);

  const initials = user?.nombre?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const rolLabel = { superadmin: 'Superadmin', admin: 'Admin', gestor: 'Gestor' }[user?.role] || '';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside role="navigation" aria-label="Menu principal" className="w-60 lg:w-64 border-r bg-card h-screen fixed left-0 top-0 flex flex-col p-4 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
          <Package size={16} weight="bold" />
        </div>
        <span className="font-semibold text-sm text-foreground">MultiCRM</span>
      </div>

      {/* Project Selector */}
      <div className="mb-6 px-1">
        <label className="text-xs font-medium text-muted-foreground px-2 mb-1.5 block">
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
      <nav className="space-y-0.5 flex-1 overflow-y-auto min-h-0">
        <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Principal</p>
        {NAV_ITEMS.filter((item) => canSeeItem(item, user?.role, activeProject?.modules)).map((item) =>
          item.children ? (
            <NavGroup key={item.label} {...item} role={user?.role} modules={activeProject?.modules} onNavigate={onNavigate} />
          ) : (
            <NavItem
              key={item.to}
              {...item}
              badge={item.to === '/leads' && newLeadsBadge > 0 ? newLeadsBadge : undefined}
              onClick={onNavigate}
            />
          )
        )}

      </nav>

      {/* Footer: Beta Badge + Theme + User */}
      <div className="mt-auto pt-4 border-t border-border space-y-3">
        {/* Beta Badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <ShieldCheck size={14} weight="regular" className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-medium">v0.1.0 Fase Beta</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
        >
          {theme === 'dark' ? <Sun size={18} weight="regular" /> : <Moon size={18} weight="regular" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>

        {/* Configuracion (solo admin/superadmin) */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all',
              isActive ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            )}
          >
            <Gear size={18} weight="regular" />
            Configuración
          </NavLink>
        )}

        {/* User */}
        <div className="flex items-center gap-3 px-2">
          <button onClick={() => { navigate('/profile'); onNavigate?.(); }} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs hover:bg-primary/20 transition-colors overflow-hidden" title="Mi perfil">
            {user?.avatar_url ? (
              <img src={`${(import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '')}/api/users/${user.id}/avatar`} alt="" className="w-full h-full object-cover" />
            ) : initials}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { navigate('/profile'); onNavigate?.(); }}>
            <p className="text-xs font-bold text-foreground truncate">{user?.nombre}</p>
            <p className="text-[10px] text-muted-foreground">{rolLabel}</p>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-red-500 transition-colors p-1" title="Cerrar sesión">
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
