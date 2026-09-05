import client, { type ApiResponse } from '@/shared/api/client';
import type { Canal } from '../lib/canales';

/**
 * Los pasos del proceso comercial.
 *
 * El servidor ya existe y está desplegado; aquí solo está la cara. El contrato
 * es el del issue #115 y no se inventa nada por encima de él.
 */

export interface Paso {
  id: number;
  project_id: number;
  /** El nombre con el que el código encuentra el paso. NO se edita. */
  clave: string;
  nombre: string;
  orden: number;
  /** La etiqueta del documento —«Lunes o martes»—, texto libre. No manda. */
  cuando: string | null;
  /** Días desde que entró el prospecto. Null en el de seguimiento. */
  dia_desde: number | null;
  dia_hasta: number | null;
  canales: Canal[];
  /** El de fin de mes: es toda la base, no la cola del día. */
  es_seguimiento: boolean;
  nota: string | null;
  activo: boolean;
}

export type PasoNuevo = {
  clave: string;
  nombre: string;
  orden?: number;
  cuando?: string | null;
  dia_desde?: number | null;
  dia_hasta?: number | null;
  canales?: Canal[];
  es_seguimiento?: boolean;
  nota?: string | null;
};

export type PasoCambios = Partial<Omit<PasoNuevo, 'clave'>> & { activo?: boolean };

export const procesoApi = {
  listar: (projectId: number, incluirInactivos = false): Promise<ApiResponse<Paso[]>> =>
    client.get(
      `/proceso/pasos?projectId=${projectId}${incluirInactivos ? '&includeInactive=true' : ''}`,
    ),

  crear: (datos: PasoNuevo & { projectId?: number }): Promise<ApiResponse<Paso>> =>
    client.post('/proceso/pasos', datos),

  /** La lista ENTERA de ids, en su nuevo orden. No un movimiento suelto. */
  reordenar: (ids: number[]): Promise<ApiResponse<Paso[]>> =>
    client.patch('/proceso/pasos/orden', { ids }),

  editar: (id: number, cambios: PasoCambios): Promise<ApiResponse<Paso>> =>
    client.patch(`/proceso/pasos/${id}`, cambios),

  /** Desactiva. No borra: el paso sigue existiendo y vuelve con el interruptor. */
  desactivar: (id: number): Promise<ApiResponse<unknown>> =>
    client.delete(`/proceso/pasos/${id}`),
};

/**
 * Lo que hay que enseñar cuando el servidor dice que no.
 *
 * Los tres que documenta el issue, con el porqué en cada uno: un «error 409»
 * a secas obliga a adivinar, y quien está delante no sabe qué es un 409.
 */
export function mensajeDeError(estado: number | undefined, porDefecto: string): string {
  if (estado === 409) return 'Ya hay un paso con esa clave en este proyecto. Elige otra.';
  if (estado === 400) return 'El día final no puede ser anterior al inicial.';
  if (estado === 404) return 'Ese paso no es de este proyecto.';
  if (estado === 403) return 'Esto solo lo puede cambiar un administrador.';
  return porDefecto;
}
