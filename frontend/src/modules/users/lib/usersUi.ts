import type { UserRole } from '@/shared/types';
import type { CrmUser } from '../api/users.api';

/**
 * Como se llama cada rol en pantalla.
 *
 * `tutor` faltaba en los desplegables aunque el backend lo acepta desde
 * siempre (user.validation.js) — dar de alta un profesor obligaba a tocar la
 * base a mano.
 */
export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  gestor: 'Gestor',
  soporte: 'Desarrollador / Soporte',
  tutor: 'Tutor / Profesor',
  colaboraciones: 'Colaboraciones',
};

/** Roles que se pueden asignar desde la pantalla. El superadmin no se otorga. */
export const ASSIGNABLE_ROLES: ReadonlyArray<{ value: UserRole; label: string; hint: string }> = [
  { value: 'admin', label: ROLE_LABELS.admin, hint: 'Acceso operativo completo. No gestiona usuarios.' },
  { value: 'gestor', label: ROLE_LABELS.gestor, hint: 'Solo sus proyectos y sus prospectos. Entra en el reparto.' },
  { value: 'soporte', label: ROLE_LABELS.soporte, hint: 'Ve todos los proyectos. Para soporte tecnico.' },
  { value: 'tutor', label: ROLE_LABELS.tutor, hint: 'Colaborador externo: solo sus formaciones y sus comisiones.' },
];

export const ROLE_STYLES: Record<string, string> = {
  superadmin: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  soporte: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  admin: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  gestor: 'bg-muted text-muted-foreground',
  tutor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  colaboraciones: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400',
};

/**
 * Quien lleva las colaboraciones tiene rol de gestora por dentro —es el unico
 * que la limita a ver solo lo suyo— pero llamarla «gestora» en pantalla es lo
 * que hace que se le asignen prospectos. Se la llama por lo que hace.
 *
 * Hoy esto casi nunca se cumple: el listado del backend no devuelve la columna
 * `gestor_colaboraciones`, asi que llega undefined. Se deja escrito para cuando
 * el SELECT la incluya.
 */
export function roleKeyOf(u: Pick<CrmUser, 'role' | 'gestor_colaboraciones'>): string {
  return u?.gestor_colaboraciones ? 'colaboraciones' : u?.role;
}

export function roleLabelOf(u: Pick<CrmUser, 'role' | 'gestor_colaboraciones'>): string {
  const key = roleKeyOf(u);
  return ROLE_LABELS[key] || key;
}

export type AccessState = 'nunca_entro' | 'activo' | 'inactivo';

/**
 * Estado de acceso, que no es lo mismo que activo/inactivo.
 *
 * «Nunca entro» es el caso que importa: el alta manda un correo con un enlace
 * de 24h, y hoy el CRM no puede mandar correo (no hay clave de Brevo). Quien no
 * pilla el enlace a tiempo se queda fuera sin que nadie se entere. Verlo en la
 * lista es la diferencia entre enterarse hoy o cuando llame.
 */
export function accessStateOf(u: Pick<CrmUser, 'active' | 'last_login_at'>): AccessState {
  if (u.active === false) return 'inactivo';
  return u.last_login_at ? 'activo' : 'nunca_entro';
}

export const ACCESS_STATE_STYLES: Record<AccessState, { label: string; className: string; title: string }> = {
  activo: {
    label: 'activo',
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    title: 'Ha entrado al CRM al menos una vez',
  },
  nunca_entro: {
    label: 'nunca ha entrado',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    title: 'Nunca ha iniciado sesion. Puede que no le llegara el correo de alta.',
  },
  inactivo: {
    label: 'inactivo',
    className: 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400',
    title: 'Desactivado: no puede entrar',
  },
};

/**
 * 'YYYY-MM-DD' → 'DD/MM/YYYY', partiendo el texto en vez de construir un Date.
 * `new Date('2026-08-19')` se interpreta como UTC y en España se pinta como el
 * 18 — un dia de ausencia de menos, justo el error que nadie revisa.
 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Hoy en 'YYYY-MM-DD' y en hora local, para los <input type="date">. */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
