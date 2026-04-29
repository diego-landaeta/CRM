import { useEffect, useState, useCallback } from 'react';

export default function usePwaInstall() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true)
  );

  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setInstallEvent(e);
    }
    function handleInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return { outcome: 'unavailable' };
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    }
    return { outcome };
  }, [installEvent]);

  return {
    canInstall: !!installEvent && !installed,
    installed,
    promptInstall,
  };
}
