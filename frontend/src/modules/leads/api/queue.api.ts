import client from '@/shared/api/client';

/** Una gestora dentro de la cola, en su orden. */
export interface GestorEnCola {
  id: number;
  nombre: string;
  email: string;
  avatar_url: string | null;
  orden_cola: number;
  active: boolean;
}

export interface EstadoCola {
  gestores: GestorEnCola[];
  /** Última vez que el round-robin del CRM movió la cola. */
  last_assigned_at: string | null;
  last_gestor: GestorEnCola | null;
  next_gestor: GestorEnCola | null;
}

/**
 * El estado del round-robin de un proyecto.
 *
 * OJO con lo que significa: esto es la cola **del CRM**. Si los prospectos de
 * este proyecto los reparte Make, la cola no se mueve y `next_gestor` es un
 * cálculo sobre un índice congelado — siempre la misma persona. Para saber si
 * está viva se usa `contarLeadsPosteriores`.
 */
export async function getEstadoCola(projectId: number): Promise<EstadoCola> {
  const res = await client.get(`/projects/${projectId}/queue-state`);
  if (!res.success) throw new Error(res.error || 'No se pudo leer el estado de la cola');
  return res.data;
}

/**
 * Cuántos prospectos entraron DESPUÉS de que la cola se moviera por última vez.
 *
 * Es la señal de si el reparto lo hace el CRM o lo hace otro. Si han entrado
 * prospectos y la cola sigue quieta, esos no los repartió el round-robin.
 *
 * Se cuenta desde el día **siguiente** a propósito. El filtro del servidor
 * trabaja por días, no por instantes, así que contar desde el mismo día
 * incluiría prospectos anteriores a la última asignación y podría acusar de
 * congelada a una cola que va bien. Con el día siguiente el dato es
 * conservador: puede quedarse corto, nunca de más.
 */
export async function contarLeadsPosteriores(projectId: number, desdeISO: string): Promise<number> {
  const diaSiguiente = new Date(desdeISO);
  diaSiguiente.setDate(diaSiguiente.getDate() + 1);
  const mes = String(diaSiguiente.getMonth() + 1).padStart(2, '0');
  const dia = String(diaSiguiente.getDate()).padStart(2, '0');
  const dateFrom = `${diaSiguiente.getFullYear()}-${mes}-${dia}`;

  // limit=1 porque solo interesa el total de la paginación, no las filas.
  const res = await client.get('/leads', {
    params: { projectId, dateFrom, limit: 1, includeConverted: true },
  });
  if (!res.success) throw new Error(res.error || 'No se pudieron contar los prospectos');
  return res.pagination?.total ?? 0;
}

export interface ResultadoReparto {
  reassigned?: number;
}

/**
 * Reparte por round-robin los prospectos que se quedaron sin responsable.
 *
 * No toca los que ya tienen a alguien: solo los huérfanos —por ejemplo, los que
 * deja atrás una gestora al desactivarse—. Solo admin y superadmin.
 */
export async function repartirPendientes(projectId: number): Promise<ResultadoReparto> {
  const res = await client.post(`/leads/reassign-pending?projectId=${projectId}`);
  if (!res.success) throw new Error(res.error || 'No se pudo repartir');
  return res.data || {};
}
