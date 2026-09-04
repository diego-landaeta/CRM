import { useCallback, useEffect, useState } from 'react';
import { listAvailability, type AvailabilityUser } from '../api/availability.api';

/**
 * Disponibilidad de todo el equipo, indexada por id de usuario.
 *
 * Va en una peticion aparte de la lista de usuarios porque el servidor las
 * tiene separadas y devuelven conjuntos distintos: aqui solo vienen admin,
 * gestor y superadmin. Un `Map` vacio para alguien no es un error, es que ese
 * rol no entra en el reparto.
 *
 * Si falla, no se rompe la pantalla: la lista de usuarios se ve igual, solo sin
 * los avisos de ausencia. Es informacion añadida, no la principal.
 */
export default function useAvailabilityMap() {
  const [porUsuario, setPorUsuario] = useState<Map<number, AvailabilityUser>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const filas = await listAvailability();
      setPorUsuario(new Map(filas.map((f) => [f.id, f])));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la disponibilidad');
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return { porUsuario, error, recargar };
}
