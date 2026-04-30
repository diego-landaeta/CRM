// Preferencias de notificaciones del usuario, persistidas en localStorage.
// Cuando exista /api/notification-preferences, este módulo se reemplaza por
// fetch al backend pero el shape se mantiene (por user_id implícito en JWT).

export type NotificationChannel = 'inApp' | 'push' | 'email';

export type NotificationKind =
  | 'lead_assigned'      // Te asignaron un lead
  | 'reminder_due'        // Recordatorio vencido
  | 'reminder_upcoming'   // Recordatorio en <1h
  | 'conversion_won'      // Lead convertido (admin/superadmin)
  | 'payment_received'    // Pago registrado
  | 'matricula_pending'   // Nueva matrícula pendiente
  | 'system_alert';       // Alertas del sistema (errores, fallos cron)

export interface NotificationPreferences {
  // Si false, ningún canal recibe notificaciones de este tipo
  enabled: Record<NotificationKind, boolean>;
  // Canales por tipo (cuando enabled[type] = true)
  channels: Record<NotificationKind, NotificationChannel[]>;
  // Modo "no molestar" — ignora todo (excepto system_alert)
  doNotDisturb: boolean;
  // Hora silencio: si está dentro del rango, solo system_alert
  quietHours: { from: string; to: string } | null; // 'HH:MM'
}

const STORAGE_KEY = 'crm.notification-preferences';

export const KIND_META: Record<NotificationKind, { label: string; description: string; defaultChannels: NotificationChannel[] }> = {
  lead_assigned: {
    label: 'Lead asignado',
    description: 'Cuando se te asigna un nuevo lead por round-robin',
    defaultChannels: ['inApp', 'push'],
  },
  reminder_due: {
    label: 'Recordatorio vencido',
    description: 'Recordatorios que ya pasaron su fecha',
    defaultChannels: ['inApp', 'push', 'email'],
  },
  reminder_upcoming: {
    label: 'Recordatorio próximo',
    description: 'Recordatorios en la próxima hora',
    defaultChannels: ['inApp', 'push'],
  },
  conversion_won: {
    label: 'Conversión registrada',
    description: 'Un lead se convierte en cliente (admin)',
    defaultChannels: ['inApp', 'email'],
  },
  payment_received: {
    label: 'Pago recibido',
    description: 'Cliente registra un abono o pago completo',
    defaultChannels: ['inApp', 'email'],
  },
  matricula_pending: {
    label: 'Matrícula pendiente',
    description: 'Nueva solicitud de admisión',
    defaultChannels: ['inApp', 'email'],
  },
  system_alert: {
    label: 'Alertas del sistema',
    description: 'Fallos en crons, integraciones caídas (siempre se entregan)',
    defaultChannels: ['inApp', 'push', 'email'],
  },
};

export function defaultPreferences(): NotificationPreferences {
  const enabled = {} as Record<NotificationKind, boolean>;
  const channels = {} as Record<NotificationKind, NotificationChannel[]>;
  for (const k of Object.keys(KIND_META) as NotificationKind[]) {
    enabled[k] = true;
    channels[k] = [...KIND_META[k].defaultChannels];
  }
  return {
    enabled,
    channels,
    doNotDisturb: false,
    quietHours: null,
  };
}

export function loadPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences();
    const parsed = JSON.parse(raw);
    // Merge con defaults para que tipos nuevos aparezcan automáticamente
    const def = defaultPreferences();
    return {
      enabled: { ...def.enabled, ...(parsed.enabled || {}) },
      channels: { ...def.channels, ...(parsed.channels || {}) },
      doNotDisturb: !!parsed.doNotDisturb,
      quietHours: parsed.quietHours || null,
    };
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event('crm:notification-prefs-changed'));
  } catch {}
}

/**
 * Determina si una notificación debe entregarse según preferencias actuales.
 * Reglas:
 *  - system_alert ignora doNotDisturb y quietHours
 *  - doNotDisturb bloquea todo lo demás
 *  - quietHours bloquea todo lo demás (rango cruzando medianoche soportado)
 *  - enabled[kind] bloquea ese tipo concreto
 *  - Si pasa todos los filtros, devuelve los canales activos
 */
export function shouldDeliver(
  prefs: NotificationPreferences,
  kind: NotificationKind,
  now: Date = new Date(),
): NotificationChannel[] {
  if (!prefs.enabled[kind]) return [];
  if (kind !== 'system_alert') {
    if (prefs.doNotDisturb) return [];
    if (prefs.quietHours && isInQuietHours(prefs.quietHours, now)) return [];
  }
  return prefs.channels[kind] || [];
}

export function isInQuietHours(qh: { from: string; to: string }, now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [fromH, fromM] = qh.from.split(':').map(Number);
  const [toH, toM] = qh.to.split(':').map(Number);
  if ([fromH, fromM, toH, toM].some(Number.isNaN)) return false;
  const fromMin = fromH * 60 + fromM;
  const toMin = toH * 60 + toM;
  if (fromMin <= toMin) {
    // Rango simple en el mismo día
    return minutes >= fromMin && minutes < toMin;
  }
  // Rango que cruza medianoche (ej: 22:00 → 07:00)
  return minutes >= fromMin || minutes < toMin;
}
