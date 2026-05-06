import {
  Users, Folder, Key, Envelope, ShieldCheck, PlugsConnected, Globe, ListChecks,
  ChatCircleText, Lightning, Receipt, EnvelopeOpen, type Icon,
} from '@phosphor-icons/react';
import type { CSSProperties } from 'react';

export interface SettingsTab {
  id: string;
  label: string;
  icon: Icon;
  to?: string;
}

export const TABS: SettingsTab[] = [
  { id: 'projects',     label: 'Proyectos',           icon: Folder },
  { id: 'users',        label: 'Usuarios',            icon: Users },
  { id: 'roles',        label: 'Roles y Permisos',    icon: ShieldCheck,    to: '/configuracion/roles' },
  { id: 'fields',       label: 'Campos custom',       icon: ListChecks,     to: '/configuracion/campos' },
  { id: 'channels',     label: 'Canales',             icon: ChatCircleText, to: '/configuracion/canales' },
  { id: 'forms',        label: 'Formularios',         icon: Globe },
  { id: 'webhooks',     label: 'Webhooks',            icon: PlugsConnected, to: '/webhooks' },
  { id: 'sequences',    label: 'Email seguimiento',   icon: Envelope,       to: '/email-sequences' },
  { id: 'templates',    label: 'Plantillas email',    icon: EnvelopeOpen,   to: '/configuracion/email-templates' },
  { id: 'shortcuts',    label: 'Atajos rápidos',      icon: Lightning,      to: '/configuracion/atajos' },
  { id: 'documents',    label: 'Numeración docs',     icon: Receipt,        to: '/configuracion/documentos' },
  { id: 'apis',         label: 'APIs globales',       icon: Key },
  { id: 'security',     label: 'Seguridad',           icon: ShieldCheck },
];

export const ROLE_STYLES: Record<string, string> = {
  superadmin: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  soporte: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  admin: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  gestor: 'bg-muted text-muted-foreground',
};

export const AVATAR_COLORS: ReadonlyArray<string> = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export const inputClass = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
export const selectClass = inputClass + ' appearance-none cursor-pointer pr-9';
export const selectBg: CSSProperties = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export const SERVICES_CATALOG = [
  { service: 'brevo', name: 'Brevo (Email transaccional)', description: 'API Key para envio de emails desde cada proyecto (remitente configurable)', placeholder: 'xkeysib-...', global: false },
  { service: 'meta', name: 'Meta Marketing API', description: 'Token larga duracion + account_id', placeholder: 'EAAD...', global: false },
  { service: 'google_ads', name: 'Google Ads API', description: 'Developer Token + OAuth2', placeholder: 'developer-token', global: false },
  { service: 'gsc', name: 'Google Search Console', description: 'OAuth2 + property URL', placeholder: 'refresh_token', global: false },
  { service: 'stripe', name: 'Stripe (Restricted Key)', description: 'Solo lectura - suscripciones', placeholder: 'rk_live_...', global: false },
  { service: 'claude', name: 'Claude AI (Anthropic)', description: 'Para reportes y chat IA', placeholder: 'sk-ant-...', global: true },
];
