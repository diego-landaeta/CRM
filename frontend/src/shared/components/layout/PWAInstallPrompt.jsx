import { useState, useEffect } from 'react';
import { DeviceMobile, X, DownloadSimple } from '@phosphor-icons/react';

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const alreadyDismissed = localStorage.getItem('crm.pwa-install-dismissed');
    if (alreadyDismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem('crm.pwa-install-dismissed', '1');
  }

  if (!visible || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-5 sm:w-80 z-50 bg-card border border-border rounded-xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <DeviceMobile size={20} weight="duotone" className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Instalar MultiCRM</p>
        <p className="text-xs text-muted-foreground mt-0.5">Accede más rápido desde tu escritorio o móvil.</p>
        <button
          onClick={handleInstall}
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <DownloadSimple size={14} weight="bold" />
          Instalar app
        </button>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Cerrar"
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}
