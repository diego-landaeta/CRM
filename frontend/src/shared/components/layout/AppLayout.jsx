import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CabeceraProvider } from './CabeceraContext';
import Toaster from './Toaster';
import CommandPalette from './CommandPalette';
import { X } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';
import { toast } from '@/shared/hooks/useToast';
import { useProjectContext } from '@/contexts/ProjectContext';
import NeedsProjectBanner from '@/shared/components/ui/NeedsProjectBanner';

// Rutas que SÍ funcionan en modo "Todos los proyectos" (vista global).
// El resto requiere un proyecto concreto (catálogo, settings, finanzas, etc.).
const ALL_PROJECTS_OK = [
  /^\/$/,                          // Dashboard
  // Prospectos (rutas reales en espanol — los regex viejos /leads no se usaban)
  /^\/prospectos$/,                // Lista de prospectos
  /^\/prospectos\/pipeline$/,      // Kanban
  /^\/prospectos\/audiencias$/,    // Audiencias Meta
  /^\/prospectos\/\d+$/,           // Detalle de prospecto
  // Clientes
  /^\/clientes$/,
  /^\/clientes\/matriculas$/,
  /^\/clientes\/\d+$/,
  // Legacy (por si algun link viejo apunta a /leads o /clients)
  /^\/leads$/, /^\/leads\/pipeline$/, /^\/leads\/\d+$/,
  /^\/clients$/, /^\/clients\/\d+$/,
  // Generales (no dependen de proyecto)
  /^\/profile$/,
  /^\/preferences$/,
  /^\/notificaciones$/,
  /^\/manual$/,
  /^\/settings$/,
  /^\/soporte$/,
  /^\/status$/,
  /^\/ai-chat$/,
  /^\/prueba_ui(?:_[a-z]+)?$/,
  // El muestrario de primitivas no depende de ningún proyecto: son piezas
  // sueltas. Sin esto, quien tenga puesto «Todos los proyectos» —que es lo
  // normal— se encuentra el aviso de «elige un proyecto» en vez de la pantalla.
  /^\/dev\/components$/,
];

function pathAllowsAll(pathname) {
  return ALL_PROJECTS_OK.some((rx) => rx.test(pathname));
}

function AllProjectsGuard({ pathname, children }) {
  const { isAllProjects } = useProjectContext();
  if (isAllProjects && !pathAllowsAll(pathname)) {
    return <div className="p-6 max-w-2xl mx-auto"><NeedsProjectBanner /></div>;
  }
  return children;
}

const FloatingDock = lazy(() => import('./FloatingDock'));
const ShortcutsFAB = lazy(() => import('./ShortcutsFAB'));
const PWAInstallPrompt = lazy(() => import('./PWAInstallPrompt'));
const PWAUpdatePrompt = lazy(() => import('./PWAUpdatePrompt'));
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));
const OfflineBanner = lazy(() => import('./OfflineBanner'));

const COLLAPSED_KEY = 'crm.sidebar.collapsed';

// Mapa de "n" (nuevo) según ruta actual
const NEW_ACTIONS = {
  '/prospectos': { url: '/prospectos?new=1', label: 'prospecto' },
  '/clientes': { url: '/prospectos?new=1', label: 'prospecto' },
  '/productos': { url: '/productos?new=1', label: 'producto' },
  '/captacion': { url: '/captacion?new=1', label: 'formulario' },
  '/captacion/webhooks': { url: '/captacion/webhooks?new=1', label: 'webhook' },
  '/secuencias-email': { url: '/secuencias-email?new=1', label: 'secuencia' },
  '/accounting/expenses': { url: '/accounting/expenses?new=1', label: 'egreso' },
  '/accounting/payable': { url: '/accounting/payable?new=1', label: 'cuenta por pagar' },
};

// Navegación rápida G + tecla
const G_TARGETS = {
  d: '/',
  l: '/prospectos',
  c: '/clientes',
  p: '/productos',
  r: '/informes',
  a: '/accounting',
  s: '/configuracion',
};

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideFloating = pathname.startsWith('/documentos');

  // Estado del prefijo "g" para navegación rápida (g + d/l/c/p/r/a/s)
  const gPendingRef = useRef(false);
  const gTimerRef = useRef(null);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  // Atajos globales de teclado
  useEffect(() => {
    function isTyping() {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (document.activeElement?.isContentEditable) return true;
      return false;
    }

    function clearGPending() {
      gPendingRef.current = false;
      if (gTimerRef.current) {
        clearTimeout(gTimerRef.current);
        gTimerRef.current = null;
      }
    }

    function onKey(e) {
      // Cmd/Ctrl + B → toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && !e.shiftKey && !e.altKey) {
        if (isTyping()) return;
        e.preventDefault();
        toggleCollapsed();
        return;
      }

      // Si el usuario está escribiendo, no procesamos atajos sin modificadores
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ? → modal de atajos (Shift+/ en teclados ES y US)
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
        clearGPending();
        return;
      }

      // Secuencia "g" + tecla
      if (gPendingRef.current) {
        const target = G_TARGETS[e.key.toLowerCase()];
        clearGPending();
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        gPendingRef.current = true;
        gTimerRef.current = setTimeout(clearGPending, 1500);
        return;
      }

      // n → nuevo (según ruta actual)
      if (e.key === 'n' || e.key === 'N') {
        const action = NEW_ACTIONS[pathname] || NEW_ACTIONS[Object.keys(NEW_ACTIONS).find((p) => pathname.startsWith(p)) || ''];
        if (action) {
          e.preventDefault();
          navigate(action.url);
          toast({ title: `Nuevo ${action.label}`, duration: 1500 });
        }
        return;
      }
    }

    function onOpenShortcuts() { setShortcutsOpen(true); }

    window.addEventListener('keydown', onKey);
    window.addEventListener('crm:open-shortcuts', onOpenShortcuts);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('crm:open-shortcuts', onOpenShortcuts);
      clearGPending();
    };
  }, [navigate, pathname]);

  return (
    // El provider envuelve a los dos: la pantalla publica su cabecera desde
    // dentro del contenido, y Topbar la lee desde arriba.
    <CabeceraProvider>
    <div className="min-h-screen bg-background">
      {/* Skip-to-content (a11y) — visible solo con foco por teclado */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-3 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:font-semibold focus:text-sm"
      >
        Saltar al contenido
      </a>

      {/* Aquí vivía una barra fija SOLO para móvil, que decía «MultiCRM» y
          nada más. La sustituye Topbar, que va en todos los tamaños y sí dice
          en qué pantalla y en qué marca estás. */}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menu"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {/* Main content - Suspense interno para que el sidebar no se desmonte al lazy-cargar paginas */}
      <main
        id="main-content"
        role="main"
        aria-label="Contenido principal"
        tabIndex={-1}
        className={cn(
          'transition-[margin] duration-200 focus:outline-none',
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        {/* La cabecera va DENTRO de la columna de contenido y es `sticky`, no
            `fixed`: así respeta el ancho del menú lateral al plegarse y no hay
            que compensar su altura con relleno arriba, que era el `pt-[72px]`
            de antes — un número a ojo que se descuadraba al cambiar la barra. */}
        <Topbar onAbrirMenu={() => setMobileOpen(true)} />

        <div className="p-4 lg:p-6 xl:p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          }>
            {/* Fade-in suave en cada cambio de ruta — key={pathname} fuerza remount */}
            <div key={pathname} className="animate-in fade-in duration-200">
              <AllProjectsGuard pathname={pathname}>
                <Outlet />
              </AllProjectsGuard>
            </div>
          </Suspense>
        </div>
      </main>

      <Toaster />
      <CommandPalette />
      {pathname.startsWith('/manual') && !mobileOpen && (
        <Suspense fallback={null}>
          <FloatingDock />
        </Suspense>
      )}
      {!hideFloating && !mobileOpen && (
        <Suspense fallback={null}>
          <ShortcutsFAB />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>
      <Suspense fallback={null}>
        <PWAUpdatePrompt />
      </Suspense>
      <Suspense fallback={null}>
        <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <OfflineBanner />
      </Suspense>
    </div>
    </CabeceraProvider>
  );
}
