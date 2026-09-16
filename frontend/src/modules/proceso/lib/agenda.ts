import type { PasoDeLead } from '../api/agenda.api';
import type { LeadStatus } from '@/shared/types';

/*
  Las decisiones de la agenda de un prospecto (#89).

  NO SE CALCULA AQUÍ EN QUÉ PASO VA. Eso lo deriva el servidor y viene en
  `hecho` y `vencido`. Diego lo dejó escrito el 08/09: «no los deduzcas otra
  vez en la pantalla o acabarán diciendo cosas distintas en los dos sitios».
  La cola del día y la ficha tienen que contar lo mismo, y la única manera de
  garantizarlo es que ninguna de las dos lo piense por su cuenta.

  Lo de aquí es lo otro: cuál de los pasos que manda el servidor es el que se
  destaca, con qué cara se pinta cada uno, y a qué fecha se aplaza.
*/

/**
 * El paso que manda: el primero que no está ni hecho ni saltado.
 *
 * Se destaca UNO y no todos los pendientes. Si alguien lleva tres sin hacer,
 * lo que necesita es que le llamen una vez, no tres avisos.
 */
export function siguientePaso(pasos: PasoDeLead[] | null | undefined): PasoDeLead | null {
  if (!pasos) return null;
  return pasos.find((p) => !p.hecho && p.estado === 'pendiente') || null;
}

export type TonoDelPaso = 'hecho' | 'saltado' | 'vencido' | 'hoy' | 'proximo';

/**
 * Con qué cara se pinta un paso.
 *
 * El orden importa: un paso hecho fuera de plazo sigue siendo un paso hecho,
 * no un atraso. Lo que se mira primero es si ya está cerrado.
 */
export function tonoDelPaso(paso: PasoDeLead): TonoDelPaso {
  if (paso.hecho) return 'hecho';
  if (paso.estado === 'saltado') return 'saltado';
  if (paso.vencido) return 'vencido';
  if (paso.dias_de_retraso === 0) return 'hoy';
  return 'proximo';
}

/**
 * Si tiene sentido planificarle el proceso a este prospecto.
 *
 * Solo se cargaron los últimos 30 días, así que uno anterior a eso llega sin
 * agenda y hay que rellenársela. Pero a quien ya compró o dijo que no, no: su
 * proceso terminó, y ofrecerle cuatro pasos por hacer es ruido que además
 * ensucia la cola del día de la gestora.
 */
const CERRADOS: LeadStatus[] = ['convertido', 'no_interesado'];

export function sePuedePlanificar(estado?: LeadStatus | string | null): boolean {
  if (!estado) return false;
  return !CERRADOS.includes(estado as LeadStatus);
}

/**
 * La fecha a la que se aplaza un paso, en el formato que espera el servidor
 * (`YYYY-MM-DD`).
 *
 * Se cuenta desde hoy y no desde la fecha que tenía puesta: quien aplaza está
 * diciendo «con esta persona, dentro de tres días», no «tres días después de
 * una fecha que ya pasó». Un paso con cinco días de atraso aplazado «a mañana»
 * tiene que caer mañana.
 *
 * Se arma con los campos locales y no con `toISOString()`, que pasa por UTC:
 * a las 23:00 en España eso devuelve el día anterior.
 */
export function fechaAplazada(dias: number, hoy: Date = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Una fecha del servidor (`2026-09-16`) leída como el día que es aquí.
 *
 * `new Date('2026-09-16')` es medianoche UTC, y al pintarla en un huso al
 * oeste sale el día ANTERIOR: en Caracas ese paso aparecía como «15 sept».
 * Con la hora pegada detrás se lee como fecha local y el día no se mueve.
 *
 * Está aquí y no en cada pantalla porque la cola del día ya lo hacía bien y la
 * ficha no: la misma fecha salía con dos días distintos según por dónde se
 * mirara, que es justo lo que el proceso no puede permitirse.
 */
export function fechaLocal(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

/** Cuántos pasos quedan cerrados, para el «3 de 5» de la cabecera. */
export function cuentaDeHechos(pasos: PasoDeLead[] | null | undefined): number {
  return (pasos || []).filter((p) => p.hecho).length;
}
