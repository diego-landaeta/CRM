import client, { type ApiResponse } from '@/shared/api/client';

/**
 * El estado de la cola de reparto de un proyecto (#11).
 *
 * El round-robin reparte los leads solo, y hasta ahora el equipo no veia a quien
 * le toca: se enteraban cuando el lead ya estaba asignado. El endpoint existia
 * desde hace tiempo y no lo llamaba nadie.
 */

export interface GestorEnCola {
  id: number;
  nombre: string;
  email: string;
  avatar_url: string | null;
  orden_cola: number | null;
  active: boolean;
}

export interface EstadoDeLaCola {
  gestores: GestorEnCola[];
  last_assigned_at: string | null;
  last_gestor: GestorEnCola | null;
  next_gestor: GestorEnCola | null;
}

export const queueApi = {
  estado: (projectId: number): Promise<ApiResponse<EstadoDeLaCola>> =>
    client.get(`/projects/${projectId}/queue-state`),
};

export default queueApi;
