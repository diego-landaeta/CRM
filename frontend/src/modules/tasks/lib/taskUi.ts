import type { Task, TaskPriority, TaskStatus, TagColor } from '../types';
import { TASK_BOARD_COLORS, TASK_TAG_COLORS } from '@/shared/lib/ui';

/**
 * Los colores del tablero (columnas, áreas y proyectos propios) y de las
 * etiquetas. Los elige quien los crea, así que son identidad y no significado:
 * viven con las demás paletas de identidad en `shared/lib/ui`.
 */
export const BOARD_COLORS: Record<string, { label: string; dot: string; head: string; chip: string }> = TASK_BOARD_COLORS;
export const TAG_COLORS: Record<TagColor, { label: string; chip: string }> = TASK_TAG_COLORS;

/**
 * Las cuatro columnas del sistema por defecto, en orden. Llevan los mismos
 * colores que una columna propia de ese color, para que el tablero no cambie
 * de aspecto el día que alguien configura las suyas.
 */
const columnaPorDefecto = (key: TaskStatus, label: string, color: keyof typeof TASK_BOARD_COLORS) =>
  ({ key, label, dot: TASK_BOARD_COLORS[color].dot, head: TASK_BOARD_COLORS[color].head });

export const DEFAULT_COLUMNS: ReadonlyArray<{ key: TaskStatus; label: string; dot: string; head: string }> = [
  columnaPorDefecto('por_hacer', 'Por hacer', 'gray'),
  columnaPorDefecto('en_curso', 'En curso', 'blue'),
  columnaPorDefecto('en_revision', 'En revisión', 'yellow'),
  columnaPorDefecto('hecha', 'Hecha', 'green'),
];

export const STATUS_LABEL: Record<string, string> = {
  por_hacer: 'Por hacer',
  en_curso: 'En curso',
  en_revision: 'En revisión',
  hecha: 'Hecha',
};

/** La prioridad sí dice algo —alta es urgente—, así que va con los tokens. */
export const PRIORITY: Record<TaskPriority, { label: string; border: string; chip: string }> = {
  alta: {
    label: 'Alta',
    border: 'border-l-destructive',
    chip: 'bg-destructive-soft text-destructive-soft-foreground border border-destructive/30',
  },
  media: {
    label: 'Media',
    border: 'border-l-warning',
    chip: 'bg-warning-soft text-warning-soft-foreground border border-warning/30',
  },
  baja: {
    label: 'Baja',
    border: 'border-l-muted-foreground/40',
    chip: 'bg-muted text-muted-foreground border border-border',
  },
};

export const boardColor = (color: string | null | undefined) => BOARD_COLORS[color || 'gray'] || BOARD_COLORS.gray;

export const tagChip = (color: string): string =>
  (TAG_COLORS[color as TagColor] || TAG_COLORS.sky).chip;

/**
 * La zona de la oficina, la misma que usa el servidor (APP_TIMEZONE) para el
 * comentario automático, el correo de cada mañana y los filtros por fecha.
 *
 * Una fecha límite es un DÍA, no una hora: elegir el 14/10 tiene que ser el
 * 14/10 para todo el equipo. Con la hora del navegador, desde Caracas el 14/10
 * a las 23:59 ya era el 15/10 en Madrid, y el comentario decía «al 15/10»
 * mientras la tarjeta enseñaba 14/10 (QA del 09/10).
 */
export const ZONA_OFICINA = 'Europe/Madrid';

/** El día (AAAA-MM-DD) que es un instante en la oficina. */
export function diaEnOficina(fecha: Date | string): string {
  // `en-CA` da justo AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_OFICINA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(fecha));
}

const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** «Vence hoy», «Vencida · 3 oct», «Mañana», «31 oct»… con su tono. */
export function dueInfo(
  task: Pick<Task, 'due_date' | 'status'>,
  ahora: Date = new Date()
): { label: string; classes: string } | null {
  if (!task.due_date) return null;
  const diff = diasEntre(diaEnOficina(ahora), diaEnOficina(task.due_date));
  const fecha = new Date(task.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: ZONA_OFICINA });
  if (task.status === 'hecha') return { label: fecha, classes: 'bg-muted text-muted-foreground' };
  if (diff < 0) return { label: `Vencida · ${fecha}`, classes: 'bg-destructive-soft text-destructive-soft-foreground' };
  if (diff === 0) return { label: 'Vence hoy', classes: 'bg-warning-soft text-warning-soft-foreground' };
  if (diff === 1) return { label: 'Mañana', classes: 'bg-info-soft text-info-soft-foreground' };
  return { label: fecha, classes: 'bg-muted text-muted-foreground' };
}

/** La fecha guardada (ISO) como la quiere un `<input type="date">`: su día en la oficina. */
export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return diaEnOficina(iso);
}

/**
 * Del `<input type="date">` a ISO: vence al final de ese día EN LA OFICINA
 * (23:59 de Madrid), esté donde esté quien la pone.
 */
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  // Las 23:59 «de pared» como si fueran UTC, y se corrige por lo que Madrid
  // se aparta de UTC ese día (1 o 2 horas según el horario de verano). A las
  // 23:59 nunca hay cambio de hora, así que basta una pasada.
  const comoUtc = Date.parse(`${value}T23:59:00Z`);
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_OFICINA, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(comoUtc)).map((p) => [p.type, p.value]));
  const pared = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute);
  return new Date(comoUtc - (pared - comoUtc)).toISOString();
}

/**
 * Entre qué dos tarjetas cae una que se suelta en la posición `index` de una
 * columna ya pintada. Devuelve `null` si se suelta donde ya estaba.
 */
export function neighboursAt(
  column: ReadonlyArray<Pick<Task, 'id'>>,
  index: number,
  draggedId: number
): { prev_id: number | null; next_id: number | null } | null {
  const before = column[index - 1];
  const after = column[index];
  if (before?.id === draggedId || after?.id === draggedId) return null;
  const sin = column.filter((t) => t.id !== draggedId);
  const at = column.slice(0, index).filter((t) => t.id !== draggedId).length;
  return { prev_id: sin[at - 1]?.id ?? null, next_id: sin[at]?.id ?? null };
}

/**
 * Quién edita una tarea (Diego, 08/10 y WhatsApp 09/10): el admin («Editar» +
 * «Ver todo») y la persona asignada. Los demás la ven y la comentan. Sin nadie
 * asignado, también quien la creó. Es la misma regla que aplica el servidor;
 * aquí solo evita ofrecer lo que daría 403.
 */
export function puedeEditarTarea(
  task: { assigned_to: number | null; created_by?: number | null } | null | undefined,
  yo: number,
  permisos: { edit: boolean; viewAll: boolean },
): boolean {
  if (!task) return false;
  return permisos.edit && ((task.assigned_to ?? task.created_by ?? null) === yo || permisos.viewAll);
}

/**
 * Lo que manda la ficha al guardar una tarea que ya existe (QA de Diego, 08/10,
 * y WhatsApp 09/10):
 *   · el estado NO va en el PATCH (el servidor lo descarta): si cambió, se
 *     mueve aparte con `moveTask`;
 *   · solo los campos que de verdad cambian: así el admin reasigna sin que
 *     parezca que edita, y no quedan comentarios de cambios que no hubo;
 *   · `assigned_to` solo con «Asignar».
 * La fecha se compara por su día en la oficina, que es lo que enseña la ficha.
 */
export function armarCambiosDeTarea<B extends Record<string, unknown>>({
  base, actual, estadoAntes, estadoNuevo, canAssign, assignedTo,
}: {
  base: B;
  actual: Partial<Record<keyof B | 'assigned_to', unknown>>;
  estadoAntes: TaskStatus;
  estadoNuevo: TaskStatus;
  canAssign: boolean;
  assignedTo: number | null;
}): { mover: TaskStatus | null; actualizar: Partial<B> & { assigned_to?: number | null } } {
  const igual = (k: string, a: unknown, b: unknown) => {
    if (k === 'due_date') return toDateInput((a as string) || null) === toDateInput((b as string) || null);
    if (a == null || a === '') return b == null || b === '';
    return b != null && String(a) === String(b);
  };
  const actualizar: Partial<B> & { assigned_to?: number | null } = {};
  for (const [k, v] of Object.entries(base)) {
    if (!igual(k, (actual as Record<string, unknown>)[k], v)) (actualizar as Record<string, unknown>)[k] = v;
  }
  const responsable = assignedTo || null;
  if (canAssign && !igual('assigned_to', actual.assigned_to, responsable)) actualizar.assigned_to = responsable;
  return { mover: estadoNuevo !== estadoAntes ? estadoNuevo : null, actualizar };
}
