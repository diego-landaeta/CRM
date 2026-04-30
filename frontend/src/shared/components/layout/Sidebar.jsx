import { useState, useEffect, useRef } from 'react';
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
  PlugsConnected,
  ShoppingBag,
  BookOpen,
  Headset,
  ActivityIcon as Activity,
  FilePdf,
  DownloadSimple,
  UserCircle,
  CaretUp,
  Wrench,
  Clock,
  EyeSlash,
  CaretLeft,
  CreditCard,
  ChatCircleText,
} from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTheme } from '@/contexts/ThemeContext';
import usePwaInstall from '@/shared/hooks/usePwaInstall';
import { cn } from '@/shared/lib/utils';
import { lazy, Suspense } from 'react';
import client from '@/shared/api/client';
import Portal from '@/shared/components/ui/portal';
import { isFloatingDockHidden, setFloatingDockHidden } from './FloatingDock';
import { toast } from '@/shared/hooks/useToast';
import { getLocalLogo } from '@/shared/lib/projectLogos';

const ProjectSettingsDialog = lazy(() => import('@/modules/settings/components/ProjectSettingsDialog'));
const NotificationsBell = lazy(() => import('./NotificationsBell'));

// Secciones del sidebar — cada una con label + items.
// Cada item: roles (omitir=todos) + module (clave en project.modules; omitir=siempre)
const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard', to: '/', icon: SquaresFour },
      { label: 'Prospectos', to: '/leads', icon: Users, module: 'leads' },
      {
        label: 'Clientes', icon: UserCheck, module: 'clients',
        children: [
          { label: 'Listado', to: '/clients', module: 'clients' },
          { label: 'Matrículas', to: '/matriculas', module: 'matriculas' },
        ],
      },
    ],
  },
  {
    label: 'Captación',
    items: [
      { label: 'Email seguimiento', to: '/email-sequences', icon: Envelope, roles: ['superadmin', 'admin'], module: 'email_sequences' },
      {
        label: 'Captación', icon: Globe, roles: ['superadmin', 'admin'],
        children: [
          { label: 'Formularios', to: '/forms', roles: ['superadmin', 'admin'] },
          { label: 'Webhooks', to: '/webhooks', roles: ['superadmin', 'admin'] },
        ],
      },
      {
        label: 'Campañas', icon: Megaphone, roles: ['superadmin', 'admin'],
        children: [
          { label: 'Consolidado', to: '/campaigns', roles: ['superadmin', 'admin'] },
          { label: 'Meta Ads', to: '/campaigns/meta', roles: ['superadmin', 'admin'] },
          { label: 'Google Ads', to: '/campaigns/google', roles: ['superadmin', 'admin'] },
          { label: 'Tráfico orgánico', to: '/seo', roles: ['superadmin', 'admin'] },
        ],
      },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      {
        label: 'Productos', icon: Package, roles: ['superadmin', 'admin'],
        children: [
          { label: 'Catálogo', to: '/products', roles: ['superadmin', 'admin'], module: 'products' },
          { label: 'Cursos pendientes', to: '/products/pending', roles: ['superadmin', 'admin'], module: 'products' },
          { label: 'WooCommerce', to: '/woocommerce', roles: ['superadmin', 'admin'], module: 'woocommerce' },
        ],
      },
      { label: 'Documentos', to: '/documentos', icon: FilePdf, roles: ['superadmin', 'admin'], module: 'documents' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
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
      // Solo visible para proyectos IA (SaaS): MRR, churn, suscripciones
      { label: 'Stripe', to: '/stripe', icon: CreditCard, roles: ['superadmin', 'admin'], projectType: 'ia' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { label: 'Reportes', to: '/reports', icon: ChartLineUp, roles: ['superadmin', 'admin'], module: 'reports' },
      { label: 'Análisis IA', to: '/reports/ia', icon: Sparkle, roles: ['superadmin', 'admin'], projectType: 'ia' },
      { label: 'Chat IA', to: '/ai-chat', icon: ChatCircleText, roles: ['superadmin', 'admin'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Soporte', to: '/soporte', icon: Headset },
      { label: 'Status', to: '/status', icon: Activity },
      { label: 'Manual de usuario', to: '/manual', icon: BookOpen },
    ],
  },
];

function canSeeItem(item, role, modules, projectType) {
  // projectType filter (e.g. solo proyectos IA): aplica a todos los roles
  if (item.projectType && projectType !== item.projectType) return false;
  // soporte ve todo (rol generico tipo dev)
  if (role === 'soporte' || role === 'superadmin') {
    if (item.module && modules && modules[item.module] === false) return false;
    return true;
  }
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.module && modules && modules[item.module] === false) return false;
  return true;
}

function NavGroup({ icon: Icon, label, children, role, modules, projectType, onNavigate, collapsed, onExpandSidebar }) {
  const visible = children.filter((c) => canSeeItem(c, role, modules, projectType));
  const location = useLocation();
  const hasActiveChild = visible.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));
  const [open, setOpen] = useState(hasActiveChild);
  if (!visible.length) return null;

  // En modo collapsed: el grupo se renderiza como un boton compacto.
  // Click → expande el sidebar y abre el grupo. Tooltip nativo via title.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => { onExpandSidebar?.(); setOpen(true); }}
        title={label}
        aria-label={label}
        className={cn(
          'w-full flex items-center justify-center h-10 rounded-md transition-colors',
          hasActiveChild ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )}
      >
        <Icon size={18} weight={hasActiveChild ? 'duotone' : 'regular'} />
      </button>
    );
  }

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

function NavItem({ to, icon: Icon, label, badge, onClick, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex items-center rounded-md text-[13px] transition-all',
          collapsed
            ? 'justify-center h-10'
            : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-primary/10 text-primary font-bold shadow-sm'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
            />
          )}
          <span className="relative">
            <Icon size={18} weight={isActive ? 'duotone' : 'regular'} />
            {collapsed && badge && (
              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-1 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          {!collapsed && label}
          {!collapsed && badge && (
            <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function ProjectAvatar({ project, size = 'md' }) {
  const { theme } = useTheme();
  const dim = size === 'sm' ? 'w-7 h-7 text-base' : 'w-8 h-8 text-lg';

  // 1) logo_url configurado en DB. Si es URL externa la usa directo;
  //    si es solo un flag (sistema antiguo de upload), usa el endpoint API.
  if (project?.logo_url) {
    const isExternalUrl = /^https?:\/\//i.test(project.logo_url);
    const src = isExternalUrl
      ? project.logo_url
      : `${(import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '')}/api/projects/${project.id}/logo`;
    return (
      <img
        src={src}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        decoding="async"
        className={`${dim} rounded-lg object-contain bg-muted/40 p-0.5 flex-shrink-0`}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }

  // 2) logo local segun slug (con variante por tema)
  const localSrc = getLocalLogo(project?.slug, theme);
  if (localSrc) {
    return (
      <img
        src={localSrc}
        alt={project.nombre || ''}
        width={24}
        height={24}
        loading="lazy"
        decoding="async"
        className={`${dim} rounded-lg object-contain bg-muted/40 p-0.5 flex-shrink-0`}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }

  // 3) emoji fallback
  if (project?.emoji) {
    return (
      <div className={`${dim} rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0`}>
        {project.emoji}
      </div>
    );
  }

  return <div className={`${dim} rounded-lg bg-muted/30 flex-shrink-0`} />;
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapsed }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeProject, switchProject, projects } = useProjectContext();
  const { theme, toggleTheme } = useTheme();
  const { canInstall, promptInstall } = usePwaInstall();
  const [configOpen, setConfigOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState(null);
  const [userMenuView, setUserMenuView] = useState('main'); // 'main' | 'hide-dock'
  const [dockHidden, setDockHidden] = useState(() => isFloatingDockHidden());
  const [newLeadsBadge, setNewLeadsBadge] = useState(0);

  // Reset al cerrar el menu
  useEffect(() => { if (!userMenuOpen) setUserMenuView('main'); }, [userMenuOpen]);

  function showDock() {
    setFloatingDockHidden(false);
    setDockHidden(false);
    setUserMenuOpen(false);
    toast({ title: 'Herramientas restauradas' });
  }
  function hideDockSession() {
    setFloatingDockHidden(true, 'session');
    setDockHidden(true);
    setUserMenuOpen(false);
    toast({
      title: 'Herramientas ocultas',
      description: 'Volverán a aparecer al recargar. Puedes restaurarlas desde el icono de la esquina o tu menú de avatar.',
      duration: 6000,
    });
  }
  function hideDockPersist() {
    setFloatingDockHidden(true, 'persist');
    setDockHidden(true);
    setUserMenuOpen(false);
    toast({
      title: 'Herramientas ocultas',
      description: 'Quedarán ocultas hasta que las restaures desde el icono de la esquina o tu menú de avatar.',
      duration: 6000,
    });
  }
  const pickerRef = useRef(null);
  const pickerBtnRef = useRef(null);
  const pickerPopRef = useRef(null);
  const userBtnRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function compute() {
      const btn = pickerBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.max(rect.width, 220);
      const maxH = Math.min(320, vh - rect.bottom - margin * 2);
      let left = rect.left;
      if (left + width + margin > vw) left = vw - width - margin;
      if (left < margin) left = margin;
      // Si no hay espacio abajo, abrir hacia arriba
      let top = rect.bottom + 6;
      if (top + maxH + margin > vh && rect.top > maxH) {
        top = rect.top - 6 - maxH;
      }
      setPickerPos({ top, left, width, maxHeight: maxH });
    }
    compute();
    function onDocClick(e) {
      if (pickerBtnRef.current?.contains(e.target)) return;
      if (pickerPopRef.current?.contains(e.target)) return;
      setPickerOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setPickerOpen(false); }
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // User menu: posicionamiento + click fuera
  useEffect(() => {
    if (!userMenuOpen || !userBtnRef.current) return;
    function compute() {
      const rect = userBtnRef.current.getBoundingClientRect();
      // Anclado al boton del avatar; el ancho lo decide el contenido (w-max)
      // pero garantizamos un minimo del ancho del trigger.
      setUserMenuPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        minWidth: rect.width,
      });
    }
    compute();
    function onDocClick(e) {
      if (userBtnRef.current?.contains(e.target)) return;
      if (userMenuRef.current?.contains(e.target)) return;
      setUserMenuOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setUserMenuOpen(false); }
    window.addEventListener('resize', compute);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', compute);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  // Cerrar el menu al cambiar de ruta
  const location = useLocation();
  useEffect(() => { setUserMenuOpen(false); }, [location.pathname]);

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
    <aside
      role="navigation"
      aria-label="Menu principal"
      className={cn(
        'border-r bg-card h-screen fixed left-0 top-0 flex flex-col z-40 transition-[width] duration-200',
        collapsed ? 'w-16 p-2' : 'w-60 lg:w-64 p-4'
      )}
    >
      {/* Logo + toggle */}
      <div className={cn('flex items-center mb-6', collapsed ? 'flex-col gap-2' : 'gap-2.5 px-2')}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm flex-shrink-0">
          <Package size={16} weight="bold" />
        </div>
        {!collapsed && (
          <>
            <span className="font-semibold text-sm text-foreground flex-1">MultiCRM</span>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Contraer barra lateral"
                title="Contraer (Ctrl+B)"
                className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <CaretLeft size={14} weight="bold" />
              </button>
            )}
          </>
        )}
        {collapsed && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expandir barra lateral"
            title="Expandir (Ctrl+B)"
            className="hidden lg:flex w-8 h-8 rounded-md items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        )}
      </div>

      {/* Project Selector */}
      <div className={cn('mb-6', collapsed ? 'px-0' : 'px-1')}>
        {!collapsed && (
          <label className="text-xs font-medium text-muted-foreground px-2 mb-1.5 block">
            Proyecto
          </label>
        )}
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-1.5' : 'gap-2')}>
          <div className={cn('relative', collapsed ? 'w-full' : 'flex-1')} ref={pickerRef}>
            <button
              type="button"
              ref={pickerBtnRef}
              onClick={() => setPickerOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-label="Selector de proyecto"
              title={collapsed ? activeProject?.nombre : undefined}
              className={cn(
                'rounded-lg border border-border text-sm font-semibold bg-secondary text-foreground outline-none cursor-pointer flex items-center focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all',
                collapsed
                  ? 'w-full h-10 justify-center'
                  : 'w-full h-9 pl-1 pr-8 gap-2'
              )}
            >
              <ProjectAvatar project={activeProject} size="sm" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{activeProject?.nombre || 'Selecciona proyecto'}</span>
                  <CaretDown size={12} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </>
              )}
            </button>
            {pickerOpen && pickerPos && (
              <Portal>
                <ul
                  ref={pickerPopRef}
                  role="listbox"
                  aria-label="Lista de proyectos"
                  style={{
                    position: 'fixed',
                    top: pickerPos.top,
                    left: pickerPos.left,
                    width: pickerPos.width,
                    maxHeight: pickerPos.maxHeight,
                  }}
                  className="z-[60] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl py-1 animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150 sidebar-scroll"
                >
                  {(() => {
                    // Orden: IAs primero, luego CRMs/academias. Dentro de cada grupo alfabetico.
                    const sorted = [...projects].sort((a, b) => {
                      const tA = a.type === 'ia' ? 0 : 1;
                      const tB = b.type === 'ia' ? 0 : 1;
                      if (tA !== tB) return tA - tB;
                      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
                    });
                    let lastType = null;
                    return sorted.map((p) => {
                      const isActive = p.id === activeProject?.id;
                      const showDivider = lastType !== null && lastType !== p.type;
                      lastType = p.type;
                      return (
                        <div key={p.id}>
                          {showDivider && <div className="my-1 mx-2 border-t border-border" />}
                          <li role="option" aria-selected={isActive}>
                            <button
                              type="button"
                              onClick={() => { switchProject(Number(p.id)); setPickerOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-secondary transition-colors',
                                isActive && 'bg-secondary font-semibold'
                              )}
                            >
                              <ProjectAvatar project={p} size="sm" />
                              <span className="flex-1 truncate">{p.nombre}</span>
                            </button>
                          </li>
                        </div>
                      );
                    });
                  })()}
                </ul>
              </Portal>
            )}
          </div>
          {(user?.role === 'admin' || user?.role === 'superadmin') && activeProject && !collapsed && (
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

      {/* Buscador (oculto en collapsed; sigue accesible via Ctrl+K) */}
      {!collapsed && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('crm:open-palette'))}
            className="w-full h-9 px-3 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors group flex items-center gap-2"
            aria-label="Abrir buscador (Cmd+K)"
          >
            <MagnifyingGlass size={14} weight="bold" className="flex-shrink-0" />
            <span className="text-sm flex-1 text-left truncate">Buscar…</span>
            <kbd className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-card text-muted-foreground/70 group-hover:text-foreground transition-colors">
              {typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
        </div>
      )}

      {configOpen && activeProject && (
        <Suspense fallback={null}>
          <ProjectSettingsDialog
            project={activeProject}
            onClose={() => setConfigOpen(false)}
          />
        </Suspense>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto min-h-0 sidebar-scroll',
        collapsed ? 'space-y-2 -mr-1 pr-1' : 'space-y-4 -mr-2 pr-2'
      )}>
        {NAV_SECTIONS.map((section, sIdx) => {
          // Filtrar items que el usuario puede ver
          const visibleItems = section.items.filter((item) => canSeeItem(item, user?.role, activeProject?.modules, activeProject?.type));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className={cn(collapsed ? 'space-y-1' : 'space-y-0.5')}>
              {!collapsed ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5">
                  {section.label}
                </p>
              ) : (
                sIdx > 0 && <div className="mx-2 my-1.5 border-t border-border" aria-hidden="true" />
              )}
              {visibleItems.map((item) =>
                item.children ? (
                  <NavGroup
                    key={item.label}
                    {...item}
                    role={user?.role}
                    modules={activeProject?.modules}
                    projectType={activeProject?.type}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                    onExpandSidebar={onToggleCollapsed}
                  />
                ) : (
                  <NavItem
                    key={item.to}
                    {...item}
                    badge={item.to === '/leads' && newLeadsBadge > 0 ? newLeadsBadge : undefined}
                    onClick={onNavigate}
                    collapsed={collapsed}
                  />
                )
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: avatar + notificaciones */}
      <div className={cn(
        'mt-auto pt-3 border-t border-border',
        collapsed ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-2'
      )}>
        <button
          ref={userBtnRef}
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label="Menu de usuario"
          title={collapsed ? `${user?.nombre || ''} · ${rolLabel}` : undefined}
          className={cn(
            'rounded-lg transition-colors flex items-center',
            collapsed
              ? 'w-10 h-10 justify-center'
              : 'flex-1 min-w-0 gap-3 p-2',
            userMenuOpen ? 'bg-secondary' : 'hover:bg-secondary/60'
          )}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0 overflow-hidden">
            {user?.avatar_url ? (
              <img src={`${(import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '')}/api/users/${user.id}/avatar`} alt="" width={36} height={36} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-foreground truncate">{user?.nombre}</p>
                <p className="text-[10px] text-muted-foreground">{rolLabel}</p>
              </div>
              <CaretUp size={12} weight="bold" className={cn('text-muted-foreground transition-transform flex-shrink-0', !userMenuOpen && 'rotate-180')} />
            </>
          )}
        </button>
        <Suspense fallback={<div className="w-9 h-9 rounded-lg bg-secondary flex-shrink-0" />}>
          <NotificationsBell />
        </Suspense>
      </div>

      {/* User menu (Portal — escapa del sidebar) */}
      {userMenuOpen && userMenuPos && (
        <Portal>
          <div
            ref={userMenuRef}
            role="menu"
            aria-label="Acciones de usuario"
            style={{ position: 'fixed', bottom: userMenuPos.bottom, left: userMenuPos.left, minWidth: userMenuPos.minWidth }}
            className="w-max max-w-[90vw] bg-card border border-border rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/5 z-[60] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-150"
          >
            {userMenuView === 'main' ? (
              <div className="py-1.5">
                <UserMenuItem
                  icon={UserCircle}
                  label="Mi perfil"
                  onClick={() => { setUserMenuOpen(false); navigate('/profile'); onNavigate?.(); }}
                />
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                  <UserMenuItem
                    icon={Gear}
                    label="Configuración"
                    onClick={() => { setUserMenuOpen(false); navigate('/settings'); onNavigate?.(); }}
                  />
                )}
                <UserMenuItem
                  icon={theme === 'dark' ? Sun : Moon}
                  label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                  onClick={() => { toggleTheme(); }}
                />
                <UserMenuItem
                  icon={Wrench}
                  label={dockHidden ? 'Mostrar flotantes' : 'Ocultar flotantes'}
                  onClick={() => { dockHidden ? showDock() : setUserMenuView('hide-dock'); }}
                />
                <div className="mx-2 my-1 border-t border-border" />
                <UserMenuItem
                  icon={SignOut}
                  label="Cerrar sesión"
                  tone="danger"
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                />
              </div>
            ) : (
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => setUserMenuView('main')}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CaretLeft size={12} weight="bold" /> Volver
                </button>
                <p className="px-4 pb-2 text-[11px] text-muted-foreground leading-relaxed">
                  Elige cuanto tiempo quedaran ocultas. Puedes restaurarlas desde aqui o desde el icono que aparecera en la esquina.
                </p>
                <button
                  type="button"
                  onClick={hideDockSession}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors"
                >
                  <Clock size={16} weight="regular" className="flex-shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Solo esta sesión</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Volverán a aparecer al recargar la página.</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={hideDockPersist}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors"
                >
                  <EyeSlash size={16} weight="regular" className="flex-shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Ocultar permanentemente</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Hasta que las restaures manualmente.</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </Portal>
      )}
    </aside>
  );
}

function UserMenuItem({ icon: Icon, label, onClick, tone = 'default' }) {
  const toneClasses = tone === 'danger'
    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
    : 'text-foreground hover:bg-muted';
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 mx-1 rounded-md py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap',
        toneClasses
      )}
      style={{ width: 'calc(100% - 8px)' }}
    >
      <Icon size={15} weight="regular" className="flex-shrink-0 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
