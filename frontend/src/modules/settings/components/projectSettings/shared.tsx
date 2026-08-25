import { useState, type ReactNode } from 'react';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';

export const inputClass = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

type ConfirmTone = 'destructive' | 'default' | 'warning';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  tone: ConfirmTone;
  confirmLabel: string;
}

const EMPTY_CONFIRM: ConfirmState = { open: false, title: '', message: '', onConfirm: null, tone: 'destructive', confirmLabel: 'Eliminar' };

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(EMPTY_CONFIRM);
  const ask = (title: string, message: string, onConfirm: () => void, tone: ConfirmTone = 'destructive', confirmLabel: string = 'Eliminar') =>
    setState({ open: true, title, message, onConfirm, tone, confirmLabel });
  const close = () => setState(EMPTY_CONFIRM);
  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      tone={state.tone}
      confirmLabel={state.confirmLabel}
      onConfirm={() => { close(); state.onConfirm?.(); }}
      onCancel={close}
    />
  );
  return { ask, dialog };
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-secundario text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export const MODULES_REGISTRY = {
  comercial: {
    label: 'Comercial',
    items: [
      { key: 'leads', label: 'Prospectos (captura + pipeline)' },
      { key: 'clients', label: 'Clientes (convertidos)', requires: ['leads'] },
      { key: 'products', label: 'Productos / Catalogo' },
      { key: 'conversions', label: 'Conversiones (ventas)', requires: ['products'] },
      { key: 'commissions', label: 'Comisiones', requires: ['products', 'conversions'] },
      { key: 'matriculas', label: 'Matriculas (post-conversion)', requires: ['conversions'] },
      { key: 'forms', label: 'Forms (editor de formularios)' },
      { key: 'email_sequences', label: 'Email seguimiento (secuencias)', requires: ['leads'] },
      { key: 'woocommerce', label: 'WooCommerce sync', requires: ['products'] },
      { key: 'platform_users', label: 'Usuarios de plataforma (modo IA)' },
    ],
  },
  contabilidad: {
    label: 'Contabilidad',
    items: [
      { key: 'accounting_income', label: 'Ingresos' },
      { key: 'accounting_expenses', label: 'Egresos' },
      { key: 'accounting_receivable', label: 'Cuentas por cobrar' },
      { key: 'accounting_payable', label: 'Cuentas por pagar' },
    ],
  },
  equipo: {
    label: 'Equipo',
    items: [{ key: 'payroll', label: 'Nóminas (fijo + horas + comisiones)' }],
  },
  reportes: {
    label: 'Reportes',
    items: [{ key: 'reports', label: 'Dashboards y reportes' }],
  },
};

export const FIELD_TYPES = [
  { v: 'text', label: 'Texto corto' },
  { v: 'textarea', label: 'Texto largo' },
  { v: 'number', label: 'Numero' },
  { v: 'date', label: 'Fecha' },
  { v: 'select', label: 'Selección' },
  { v: 'boolean', label: 'Si/No' },
];

export const BASE_FIELDS = [
  { key: 'nombre', label: 'Nombre', alwaysRequired: true },
  { key: 'email', label: 'Email', alwaysRequired: true },
  { key: 'telefono', label: 'Teléfono', alwaysRequired: false },
  { key: 'producto_interes_id', label: 'Producto de interés', alwaysRequired: false },
  { key: 'notas', label: 'Notas', alwaysRequired: false },
];

export const DEFAULT_COLUMNS = [
  { key: 'nombre', label: 'Nombre', visible: true },
  { key: 'email', label: 'Email', visible: true },
  { key: 'telefono', label: 'Teléfono', visible: true },
  { key: 'canal_detectado', label: 'Origen', visible: true },
  { key: 'status', label: 'Estado', visible: true },
  { key: 'responsable_nombre', label: 'Gestor', visible: true },
  { key: 'fecha_solicitud', label: 'Fecha', visible: true },
];

export const AVAILABLE_EXTRA_COLUMNS = [
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'utm_campaign', label: 'UTM Campaign' },
  { key: 'dias_inactivo', label: 'Días inactivo' },
  { key: 'last_interaction_at', label: 'Última interacción' },
  { key: 'updated_at', label: 'Actualizado' },
  { key: 'reincidente', label: 'Reincidente' },
];

export const PROJECT_SERVICES = [
  { service: 'brevo', name: 'Brevo (Email)', description: 'API Key para emails transaccionales de este proyecto', placeholder: 'xkeysib-...' },
  { service: 'meta', name: 'Meta Marketing', description: 'Token + account_id del pixel/cuenta publicitaria', placeholder: 'EAAD...' },
  { service: 'google_ads', name: 'Google Ads', description: 'Developer token + OAuth refresh token', placeholder: 'dev-token' },
  { service: 'gsc', name: 'Google Search Console', description: 'OAuth + property URL', placeholder: 'refresh_token' },
  { service: 'stripe', name: 'Stripe', description: 'Restricted key (solo lectura)', placeholder: 'rk_live_...' },
];
