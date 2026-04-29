import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toaster from './Toaster';
import CommandPalette from './CommandPalette';
import { List, X } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';
import { toast } from '@/shared/hooks/useToast';

const FloatingDock = lazy(() => import('./FloatingDock'));
const PWAInstallPrompt = lazy(() => import('./PWAInstallPrompt'));
const PWAUpdatePrompt = lazy(() => import('./PWAUpdatePrompt'));
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));

const COLLAPSED_KEY = 'crm.sidebar.collapsed';

// Mapa de "n" (nuevo) según ruta actual
const NEW_ACTIONS = {
  '/leads': { url: '/leads?new=1', label: 'prospecto' },
  '/clients': { url: '/leads?new=1', label: 'prospecto' },
  '/products': { url: '/products?new=1', label: 'producto' },
  '/forms': { url: '/forms?new=1', label: 'formulario' },
  '/webhooks': { url: '/webhooks?new=1', label: 'webhook' },
  '/email-sequences': { url: '/email-sequences?new=1', label: 'secuencia' },
  '/accounting/expenses': { url: '/accounting/expenses?new=1', label: 'egreso' },
  '/accounting/payable': { url: '/accounting/payable?new=1', label: 'cuenta por pagar' },
};

// Navegación rápida G + tecla
const G_TARGETS = {
  d: '/',
  l: '/leads',
  c: '/clients',
  p: '/products',
  r: '/reports',
  a: '/accounting',
  s: '/settings',
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
    <div className="min-h-screen bg-background">
      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded-md hover:bg-muted transition-colors"
        >
          <List size={22} weight="bold" />
        </button>
        <span className="ml-3 font-semibold text-sm">MultiCRM</span>
      </div>

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
        role="main"
        aria-label="Contenido principal"
        className={cn(
          'p-4 pt-[72px] lg:p-6 lg:pt-6 xl:p-8 transition-[margin] duration-200',
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>

      <Toaster />
      <CommandPalette />
      {!hideFloating && (
        <Suspense fallback={null}>
          <FloatingDock />
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
    </div>
  );
}
