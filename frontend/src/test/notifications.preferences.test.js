import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  shouldDeliver,
  isInQuietHours,
  KIND_META,
} from '@/modules/notificaciones/lib/preferences';

describe('notifications/preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('defaultPreferences', () => {
    it('todos los kinds están enabled por default', () => {
      const p = defaultPreferences();
      for (const k of Object.keys(KIND_META)) {
        expect(p.enabled[k]).toBe(true);
      }
    });

    it('cada kind tiene canales por default según KIND_META', () => {
      const p = defaultPreferences();
      for (const k of Object.keys(KIND_META)) {
        expect(p.channels[k]).toEqual(KIND_META[k].defaultChannels);
      }
    });

    it('doNotDisturb default es false, quietHours null', () => {
      const p = defaultPreferences();
      expect(p.doNotDisturb).toBe(false);
      expect(p.quietHours).toBeNull();
    });
  });

  describe('save/load', () => {
    it('save + load es idempotente', () => {
      const p = defaultPreferences();
      p.doNotDisturb = true;
      p.channels.lead_assigned = ['email'];
      savePreferences(p);
      const loaded = loadPreferences();
      expect(loaded.doNotDisturb).toBe(true);
      expect(loaded.channels.lead_assigned).toEqual(['email']);
    });

    it('load devuelve defaults si no hay nada guardado', () => {
      const p = loadPreferences();
      expect(p).toEqual(defaultPreferences());
    });

    it('load resiliente a JSON corrupto', () => {
      localStorage.setItem('crm.notification-preferences', 'not-json');
      const p = loadPreferences();
      expect(p).toEqual(defaultPreferences());
    });

    it('merge con defaults: kinds nuevos aparecen aunque storage sea viejo', () => {
      // Simulamos storage con sólo 1 kind (versión vieja)
      localStorage.setItem('crm.notification-preferences', JSON.stringify({
        enabled: { lead_assigned: false },
        channels: { lead_assigned: ['email'] },
      }));
      const p = loadPreferences();
      expect(p.enabled.lead_assigned).toBe(false);
      expect(p.enabled.system_alert).toBe(true); // viene del default
      expect(p.channels.system_alert).toBeDefined();
    });
  });

  describe('shouldDeliver', () => {
    it('si enabled[kind]=false → vacío', () => {
      const p = defaultPreferences();
      p.enabled.lead_assigned = false;
      expect(shouldDeliver(p, 'lead_assigned')).toEqual([]);
    });

    it('doNotDisturb bloquea todo EXCEPTO system_alert', () => {
      const p = defaultPreferences();
      p.doNotDisturb = true;
      expect(shouldDeliver(p, 'lead_assigned')).toEqual([]);
      expect(shouldDeliver(p, 'reminder_due')).toEqual([]);
      expect(shouldDeliver(p, 'system_alert').length).toBeGreaterThan(0);
    });

    it('quietHours bloquea todo EXCEPTO system_alert', () => {
      const p = defaultPreferences();
      p.quietHours = { from: '22:00', to: '08:00' };
      const insideNight = new Date('2026-01-01T23:00:00');
      const insideMorning = new Date('2026-01-01T07:00:00');
      const outside = new Date('2026-01-01T15:00:00');
      expect(shouldDeliver(p, 'lead_assigned', insideNight)).toEqual([]);
      expect(shouldDeliver(p, 'lead_assigned', insideMorning)).toEqual([]);
      expect(shouldDeliver(p, 'system_alert', insideNight).length).toBeGreaterThan(0);
      expect(shouldDeliver(p, 'lead_assigned', outside).length).toBeGreaterThan(0);
    });

    it('devuelve los canales configurados cuando todo está OK', () => {
      const p = defaultPreferences();
      p.channels.lead_assigned = ['inApp', 'email'];
      const r = shouldDeliver(p, 'lead_assigned', new Date('2026-01-01T12:00:00'));
      expect(r).toEqual(['inApp', 'email']);
    });
  });

  describe('isInQuietHours', () => {
    it('rango simple en mismo día (08:00-12:00)', () => {
      const qh = { from: '08:00', to: '12:00' };
      expect(isInQuietHours(qh, new Date('2026-01-01T07:59:00'))).toBe(false);
      expect(isInQuietHours(qh, new Date('2026-01-01T08:00:00'))).toBe(true);
      expect(isInQuietHours(qh, new Date('2026-01-01T11:59:00'))).toBe(true);
      expect(isInQuietHours(qh, new Date('2026-01-01T12:00:00'))).toBe(false);
    });

    it('rango cruzando medianoche (22:00-08:00)', () => {
      const qh = { from: '22:00', to: '08:00' };
      expect(isInQuietHours(qh, new Date('2026-01-01T22:00:00'))).toBe(true);
      expect(isInQuietHours(qh, new Date('2026-01-01T23:30:00'))).toBe(true);
      expect(isInQuietHours(qh, new Date('2026-01-01T07:00:00'))).toBe(true);
      expect(isInQuietHours(qh, new Date('2026-01-01T08:00:00'))).toBe(false);
      expect(isInQuietHours(qh, new Date('2026-01-01T15:00:00'))).toBe(false);
    });

    it('formato inválido devuelve false (no rompe)', () => {
      expect(isInQuietHours({ from: 'abc', to: '08:00' }, new Date())).toBe(false);
    });
  });
});
