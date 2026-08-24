import { useCallback, useEffect, useState } from 'react';
import { contarLeadsPosteriores, getEstadoCola, type EstadoCola } from '../api/queue.api';

/** Cada cuánto se refresca, igual que el listado de prospectos. */
export const REFRESCO_MS = 30_000;

export type SaludCola =
  /** Aún no se sabe. */
  | 'cargando'
  /** No hay nadie en la cola: no se puede repartir. */
  | 'sin_gestores'
  /** La cola se mueve: el reparto lo hace el CRM. */
  | 'viva'
  /** Han entrado prospectos y la cola sigue quieta: los reparte otro. */
  | 'congelada';

export interface Cola {
  estado: EstadoCola | null;
  salud: SaludCola;
  /** Prospectos entrados desde que la cola se movió. Solo si está congelada. */
  posteriores: number;
  error: string | null;
  recargar: () => void;
}

/**
 * El estado del round-robin, y si de verdad se está usando.
 *
 * Lo segundo es la parte que importa. El endpoint devuelve un «siguiente»
 * calculado como `gestores[(último + 1) % total]`, y ese cálculo da un nombre
 * siempre — aunque el índice lleve meses sin moverse. Un panel que lo pinte sin
 * más enseña una cola que ya no se usa, con la cara de una que sí.
 *
 * Aquí se contrasta con la realidad: si han entrado prospectos después de la
 * última vez que la cola se movió, es que los repartió otro (hoy, Make). Son
 * dos peticiones que la pantalla ya sabe hacer, sin tocar el servidor.
 */
export default function useQueueState(projectId?: number): Cola {
  const [estado, setEstado] = useState<EstadoCola | null>(null);
  const [posteriores, setPosteriores] = useState(0);
  const [salud, setSalud] = useState<SaludCola>('cargando');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!projectId || projectId <= 0) return;
    try {
      const datos = await getEstadoCola(projectId);
      setEstado(datos);
      setError(null);

      if (!datos.gestores || datos.gestores.length === 0) {
        setSalud('sin_gestores');
        setPosteriores(0);
        return;
      }
      // Sin fecha de último reparto no hay con qué comparar: no se acusa.
      if (!datos.last_assigned_at) {
        setSalud('viva');
        setPosteriores(0);
        return;
      }
      const n = await contarLeadsPosteriores(projectId, datos.last_assigned_at);
      setPosteriores(n);
      setSalud(n > 0 ? 'congelada' : 'viva');
    } catch (err: any) {
      setError(err?.message || 'No se pudo leer la cola');
      setSalud('cargando');
    }
  }, [projectId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!projectId || projectId <= 0) return undefined;
    const id = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [projectId, cargar]);

  return { estado, salud, posteriores, error, recargar: cargar };
}
