import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  shouldDeliver,
  isInQuietHours,
  KIND_META,
} from '@/modules/notificaciones/lib/preferences';

beforeEach(() => {
  localStorage.clear();
});

describe('defaultPreferences', () => {
  it('todos los kinds quedan enabled por defecto', () => {
    const def = defaultPreferences();
    for (const k of Object.keys(KIND_META)) {
      expect(def.enabled[k]).toBe(true);
    }
  });

  it('cada kind tiene canales configurados según KIND_META', () => {
    const def = defaultPreferences();
    expect(def.channels.lead_assigned).toEqual(['inApp', 'push']);
    expect(def.channels.system_alert).toEqual(['inApp', 'push', 'email']);
  });

  it('doNotDisturb=false y quietHours=null por defecto', () => {
    const def = defaultPreferences();
    expect(def.doNotDisturb).toBe(false);
    expect(def.quietHours).toBeNull();
  });
});

describe('loadPreferences / savePreferences', () => {
  it('sin storage devuelve defaults', () => {
    const r = loadPreferences();
    expect(r.doNotDisturb).toBe(false);
    expect(r.enabled.lead_assigned).toBe(true);
  });

  it('storage corrupto devuelve defaults sin lanzar', () => {
    localStorage.setItem('crm.notification-preferences', 'no-json{');
    expect(() => loadPreferences()).not.toThrow();
    expect(loadPreferences().doNotDisturb).toBe(false);
  });

  it('savePreferences persiste y loadPreferences recupera', () => {
    const next = defaultPreferences();
    next.doNotDisturb = true;
    savePreferences(next);
    expect(loadPreferences().doNotDisturb).toBe(true);
  });

  it('preferencias guardadas se mergean con defaults nuevos (forward-compat)', () => {
    // Simulamos un storage antiguo sin nuevos campos
    localStorage.setItem('crm.notification-preferences', JSON.stringify({
      enabled: { lead_assigned: false },
      channels: {},
    }));
    const r = loadPreferences();
    expect(r.enabled.lead_assigned).toBe(false); // override aplicado
    expect(r.enabled.system_alert).toBe(true); // default mergeado
    expect(r.channels.system_alert).toEqual(['inApp', 'push', 'email']);
  });
});

describe('isInQuietHours', () => {
  it('rango simple del mismo día', () => {
    const qh = { from: '09:00', to: '18:00' };
    expect(isInQuietHours(qh, new Date('2026-04-15T10:30:00'))).toBe(true);
    expect(isInQuietHours(qh, new Date('2026-04-15T19:00:00'))).toBe(false);
    expect(isInQuietHours(qh, new Date('2026-04-15T08:59:00'))).toBe(false);
  });

  it('rango cruzando medianoche (22:00 → 07:00)', () => {
    const qh = { from: '22:00', to: '07:00' };
    expect(isInQuietHours(qh, new Date('2026-04-15T23:30:00'))).toBe(true);
    expect(isInQuietHours(qh, new Date('2026-04-15T03:00:00'))).toBe(true);
    expect(isInQuietHours(qh, new Date('2026-04-15T12:00:00'))).toBe(false);
  });

  it('rango inválido devuelve false', () => {
    expect(isInQuietHours({ from: 'abc', to: 'def' }, new Date())).toBe(false);
  });

  it('límites del rango: incluye desde, excluye hasta', () => {
    const qh = { from: '10:00', to: '11:00' };
    expect(isInQuietHours(qh, new Date('2026-04-15T10:00:00'))).toBe(true);
    expect(isInQuietHours(qh, new Date('2026-04-15T10:59:59'))).toBe(true);
    expect(isInQuietHours(qh, new Date('2026-04-15T11:00:00'))).toBe(false);
  });
});

describe('shouldDeliver', () => {
  it('kind disabled no entrega', () => {
    const p = defaultPreferences();
    p.enabled.lead_assigned = false;
    expect(shouldDeliver(p, 'lead_assigned')).toEqual([]);
  });

  it('kind enabled entrega los canales configurados', () => {
    const p = defaultPreferences();
    expect(shouldDeliver(p, 'lead_assigned')).toEqual(['inApp', 'push']);
  });

  it('doNotDisturb bloquea todo excepto system_alert', () => {
    const p = defaultPreferences();
    p.doNotDisturb = true;
    expect(shouldDeliver(p, 'lead_assigned')).toEqual([]);
    expect(shouldDeliver(p, 'reminder_due')).toEqual([]);
    expect(shouldDeliver(p, 'system_alert')).toEqual(['inApp', 'push', 'email']);
  });

  it('quietHours bloquea todo excepto system_alert', () => {
    const p = defaultPreferences();
    p.quietHours = { from: '10:00', to: '11:00' };
    const inQuiet = new Date('2026-04-15T10:30:00');
    expect(shouldDeliver(p, 'lead_assigned', inQuiet)).toEqual([]);
    expect(shouldDeliver(p, 'system_alert', inQuiet)).toEqual(['inApp', 'push', 'email']);
  });

  it('fuera de quietHours entrega normal', () => {
    const p = defaultPreferences();
    p.quietHours = { from: '22:00', to: '07:00' };
    const day = new Date('2026-04-15T15:00:00');
    expect(shouldDeliver(p, 'lead_assigned', day)).toEqual(['inApp', 'push']);
  });

  it('canales custom (sin email) se respetan', () => {
    const p = defaultPreferences();
    p.channels.lead_assigned = ['inApp'];
    expect(shouldDeliver(p, 'lead_assigned')).toEqual(['inApp']);
  });

  it('system_alert con doNotDisturb + quietHours sigue entregando', () => {
    const p = defaultPreferences();
    p.doNotDisturb = true;
    p.quietHours = { from: '00:00', to: '23:59' };
    const inQuiet = new Date('2026-04-15T12:00:00');
    expect(shouldDeliver(p, 'system_alert', inQuiet)).toEqual(['inApp', 'push', 'email']);
  });
});
