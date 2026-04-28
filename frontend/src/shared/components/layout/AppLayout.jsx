import { useState, Suspense, lazy } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toaster from './Toaster';
import CommandPalette from './CommandPalette';
import { List, X } from '@phosphor-icons/react';

const AIChatTrigger = lazy(() => import('@/modules/ai-chat/components/AIChatTrigger'));
const ChannelPanel = lazy(() => import('./ChannelPanel'));
const PWAInstallPrompt = lazy(() => import('./PWAInstallPrompt'));
const PWAUpdatePrompt = lazy(() => import('./PWAUpdatePrompt'));

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const hideFloating = pathname.startsWith('/documentos');

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
        <Sidebar />
      </div>

      {/* Main content - Suspense interno para que el sidebar no se desmonte al lazy-cargar paginas */}
      <main role="main" aria-label="Contenido principal" className="lg:ml-64 p-4 pt-[72px] lg:p-6 lg:pt-6 xl:p-8">
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
          <AIChatTrigger />
        </Suspense>
      )}
      {!hideFloating && (
        <Suspense fallback={null}>
          <ChannelPanel />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>
      <Suspense fallback={null}>
        <PWAUpdatePrompt />
      </Suspense>
    </div>
  );
}
