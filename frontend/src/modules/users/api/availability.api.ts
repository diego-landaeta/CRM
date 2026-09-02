import client from '@/shared/api/client';

/**
 * Disponibilidad para el reparto de prospectos.
 *
 * Dos mecanismos distintos que hacen lo mismo por caminos distintos:
 *
 *  · el interruptor  — «no disponible» hasta que alguien lo vuelva a encender
 *  · los bloques     — un rango de fechas; se activa y se apaga solo
 *
 * Las fechas viajan como texto 'YYYY-MM-DD' en los dos endpoints: el pool tiene
 * el parser de DATE desactivado (db.js), asi que no llegan como Date ni se
 * desplazan por zona horaria.
 */

export interface AvailabilityUser {
  id: number;
  nombre: string;
  email: string;
  role: string;
  active: boolean;
  is_available: boolean;
  unavailable_reason: string | null;
  unavailable_since: string | null;
  bloque_activo: { id: number; fecha_inicio: string; fecha_fin: string; motivo: string | null } | null;
  bloques_futuros: number;
}

export interface AvailabilityBlock {
  id: number;
  user_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  created_at: string;
  /** Lo calcula el servidor con CURRENT_DATE — no se recalcula aqui. */
  activo?: boolean;
}

/**
 * OJO: el servidor solo devuelve admin, gestor y superadmin. Ni tutores ni
 * soporte, que tampoco entran en el reparto. Quien consuma esto no puede dar
 * por hecho que hay una fila por cada usuario del CRM.
 */
export async function listAvailability(): Promise<AvailabilityUser[]> {
  const res = await client.get('/users/availability');
  if (!res.success) throw new Error(res.error || 'No se pudo cargar la disponibilidad');
  return res.data || [];
}

export async function setAvailability(
  userId: number,
  isAvailable: boolean,
  motivo?: string | null,
): Promise<void> {
  const res = await client.patch(`/users/${userId}/availability`, {
    is_available: isAvailable,
    motivo: motivo || null,
  });
  if (!res.success) throw new Error(res.error || 'No se pudo cambiar la disponibilidad');
}

export async function listBlocks(userId: number): Promise<AvailabilityBlock[]> {
  const res = await client.get(`/users/${userId}/availability-blocks`);
  if (!res.success) throw new Error(res.error || 'No se pudieron cargar las ausencias');
  return res.data || [];
}

export async function createBlock(
  userId: number,
  block: { fecha_inicio: string; fecha_fin: string; motivo?: string | null },
): Promise<AvailabilityBlock> {
  const res = await client.post(`/users/${userId}/availability-blocks`, {
    fecha_inicio: block.fecha_inicio,
    fecha_fin: block.fecha_fin,
    motivo: block.motivo || null,
  });
  if (!res.success) throw new Error(res.error || 'No se pudo crear la ausencia');
  return res.data;
}

/** La ruta NO lleva el id del usuario: es /users/availability-blocks/:blockId. */
export async function deleteBlock(blockId: number): Promise<void> {
  const res = await client.delete(`/users/availability-blocks/${blockId}`);
  if (!res.success) throw new Error(res.error || 'No se pudo eliminar la ausencia');
}
