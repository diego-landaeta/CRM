import { useCallback, useEffect, useState } from 'react';
import {
  loadPreferences,
  savePreferences,
  shouldDeliver,
  type NotificationKind,
  type NotificationPreferences,
} from '../lib/preferences';

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UseNotificationsResult {
  permission: PermissionState;
  isSupported: boolean;
  isPushSupported: boolean;
  isSubscribed: boolean;
  prefs: NotificationPreferences;
  requestPermission: () => Promise<PermissionState>;
  /**
   * Suscribe al Service Worker para Push API. Hoy está mockeado: marca el
   * estado como suscrito y guarda la subscription en localStorage para que
   * el backend la consuma cuando exista /api/push-subscriptions.
   * En producción, debería llamar a `pushManager.subscribe({ userVisibleOnly:true, applicationServerKey })`
   * con la VAPID public key del backend.
   */
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  /**
   * Muestra una notificación local (sin pasar por servidor). Se usa para
   * "Probar notificación" y para entregas in-app que no requieren push real.
   */
  showLocal: (title: string, options?: NotificationOptions) => void;
  /**
   * Determina si una notificación de cierto tipo debe entregarse según
   * las preferencias actuales. Devuelve los canales activos.
   */
  canDeliver: (kind: NotificationKind) => string[];
  updatePrefs: (next: NotificationPreferences) => void;
}

const SUBSCRIPTION_KEY = 'crm.push-subscription';

function readPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

export function useNotifications(): UseNotificationsResult {
  const [permission, setPermission] = useState<PermissionState>(() => readPermission());
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => loadPreferences());
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    try { return !!localStorage.getItem(SUBSCRIPTION_KEY); } catch { return false; }
  });

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const isPushSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  // Sincronizar prefs cuando cambien desde otra pestaña/módulo
  useEffect(() => {
    function onChange() {
      setPrefs(loadPreferences());
    }
    window.addEventListener('crm:notification-prefs-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('crm:notification-prefs-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!isSupported) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      return result as PermissionState;
    } catch {
      return 'denied';
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false;
    if (Notification.permission !== 'granted') {
      const next = await Notification.requestPermission();
      setPermission(next as PermissionState);
      if (next !== 'granted') return false;
    }

    // En producción aquí iría:
    //   const reg = await navigator.serviceWorker.ready;
    //   const sub = await reg.pushManager.subscribe({
    //     userVisibleOnly: true,
    //     applicationServerKey: VAPID_PUBLIC_KEY,
    //   });
    //   await fetch('/api/push-subscriptions', { method: 'POST', body: JSON.stringify(sub) });
    //
    // Por ahora marcamos suscripción local hasta que backend tenga el endpoint.
    try {
      const placeholder = {
        endpoint: 'local-only',
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(placeholder));
      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    }
  }, [isPushSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      localStorage.removeItem(SUBSCRIPTION_KEY);
      setIsSubscribed(false);
      // En producción aquí también: await reg.pushManager.getSubscription()?.unsubscribe()
      // y DELETE /api/push-subscriptions.
    } catch {}
  }, []);

  const showLocal = useCallback((title: string, options: NotificationOptions = {}): void => {
    if (permission !== 'granted') return;
    try {
      // Service worker showNotification es preferible (sobrevive al close del tab)
      // pero requiere registration. Fallback a Notification directa.
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const iconPath = `${(import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '')}/icons/icon-192.png`;
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            badge: iconPath,
            icon: iconPath,
            ...options,
          });
        });
      } else {
        new Notification(title, options);
      }
    } catch {
      // Algunos navegadores throw si el constructor se llama sin gesture
    }
  }, [permission]);

  const canDeliver = useCallback(
    (kind: NotificationKind): string[] => shouldDeliver(prefs, kind),
    [prefs],
  );

  const updatePrefs = useCallback((next: NotificationPreferences): void => {
    setPrefs(next);
    savePreferences(next);
  }, []);

  return {
    permission,
    isSupported,
    isPushSupported,
    isSubscribed,
    prefs,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocal,
    canDeliver,
    updatePrefs,
  };
}
