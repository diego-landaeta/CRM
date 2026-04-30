import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '@/modules/notificaciones/hooks/useNotifications';

let permState: 'default' | 'granted' | 'denied' = 'default';
let requestImpl: () => Promise<string> = async () => 'granted';

function setupNotificationMock() {
  const NotificationMock: any = vi.fn();
  Object.defineProperty(NotificationMock, 'permission', {
    configurable: true,
    get: () => permState,
  });
  Object.defineProperty(NotificationMock, 'requestPermission', {
    configurable: true,
    get: () => requestImpl,
  });
  vi.stubGlobal('Notification', NotificationMock);
  (window as any).Notification = NotificationMock;
  // Mock serviceWorker + PushManager para que isPushSupported sea true
  if (!('serviceWorker' in navigator)) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
  }
  (window as any).PushManager = function () {};
}

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    permState = 'default';
    requestImpl = async () => 'granted';
    setupNotificationMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lee permission inicial', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.permission).toBe('default');
  });

  it('isSupported=true cuando Notification está disponible', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.isSupported).toBe(true);
  });

  it('requestPermission llama API y actualiza estado', async () => {
    const spy = vi.fn(async () => 'granted');
    requestImpl = spy;
    const { result } = renderHook(() => useNotifications());
    let r;
    await act(async () => { r = await result.current.requestPermission(); });
    expect(r).toBe('granted');
    expect(spy).toHaveBeenCalled();
    expect(result.current.permission).toBe('granted');
  });

  it('requestPermission devuelve "denied" si la API throwea', async () => {
    requestImpl = async () => { throw new Error('blocked'); };
    const { result } = renderHook(() => useNotifications());
    let r;
    await act(async () => { r = await result.current.requestPermission(); });
    expect(r).toBe('denied');
  });

  it('subscribe sin permission previo lo solicita', async () => {
    permState = 'default';
    const spy = vi.fn(async () => 'granted');
    requestImpl = spy;
    const { result } = renderHook(() => useNotifications());
    let ok;
    await act(async () => { ok = await result.current.subscribe(); });
    expect(spy).toHaveBeenCalled();
    expect(ok).toBe(true);
    expect(result.current.isSubscribed).toBe(true);
  });

  it('subscribe NO suscribe si el usuario rechaza', async () => {
    permState = 'default';
    requestImpl = async () => 'denied';
    const { result } = renderHook(() => useNotifications());
    let ok;
    await act(async () => { ok = await result.current.subscribe(); });
    expect(ok).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
  });

  it('unsubscribe limpia subscription', async () => {
    permState = 'granted';
    const { result } = renderHook(() => useNotifications());
    await act(async () => { await result.current.subscribe(); });
    expect(result.current.isSubscribed).toBe(true);
    await act(async () => { await result.current.unsubscribe(); });
    expect(result.current.isSubscribed).toBe(false);
    expect(localStorage.getItem('crm.push-subscription')).toBeNull();
  });

  it('updatePrefs persiste en localStorage', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({
        ...result.current.prefs,
        doNotDisturb: true,
      });
    });
    expect(result.current.prefs.doNotDisturb).toBe(true);
    const saved = JSON.parse(localStorage.getItem('crm.notification-preferences') as string);
    expect(saved.doNotDisturb).toBe(true);
  });

  it('canDeliver respeta doNotDisturb', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.updatePrefs({
        ...result.current.prefs,
        doNotDisturb: true,
      });
    });
    expect(result.current.canDeliver('lead_assigned')).toEqual([]);
    expect(result.current.canDeliver('system_alert').length).toBeGreaterThan(0);
  });

  it('responde al evento "crm:notification-prefs-changed" desde otra pestaña', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.prefs.doNotDisturb).toBe(false);
    act(() => {
      localStorage.setItem('crm.notification-preferences', JSON.stringify({
        ...result.current.prefs,
        doNotDisturb: true,
      }));
      window.dispatchEvent(new Event('crm:notification-prefs-changed'));
    });
    expect(result.current.prefs.doNotDisturb).toBe(true);
  });
});
