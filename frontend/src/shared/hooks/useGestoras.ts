import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/shared/api/client';

/**
 * La lista de gestoras por las que se puede filtrar, y si quien mira puede.
 *
 * Es el punto 1 del #130: «Admin — el equipo entero, y poder filtrar por
 * gestora y por proyecto». La misma consulta que ya hacia `ColaDelDiaPage`,
 * sacada aqui para que las dos pantallas pregunten lo mismo.
 *
 * OJO CON LO QUE ESTO **NO** ES
 *
 * No es seguridad. `puedeFiltrar` decide si se pinta un desplegable, nada mas:
 * el recorte de verdad lo hace el servidor —`asesoraDelInforme()` en los
 * informes, el `gestoraId` del proceso y el `responsableId` de los leads—, que
 * para una gestora devuelve su propio id pida lo que pida. Esconder el filtro
 * y fiarse de eso seria dejar la puerta abierta a quien escriba la direccion a
 * mano, que es justo lo que el ticket manda evitar.
 */
export type Gestora = { id: number; nombre: string };

export function useGestoras(projectId?: number | null) {
  const { user } = useAuth();
  const puedeFiltrar = user?.role === 'admin' || user?.role === 'superadmin';
  const [gestoras, setGestoras] = useState<Gestora[]>([]);

  useEffect(() => {
    if (!puedeFiltrar) { setGestoras([]); return; }
    let vivo = true;
    client.get(`/users?limit=100${projectId ? `&projectId=${projectId}` : ''}`)
      .then((r: any) => {
        if (!vivo || !r?.success) return;
        setGestoras((r.data || [])
          .filter((u: any) => u.active !== false)
          .map((u: any) => ({ id: u.id, nombre: u.nombre })));
      })
      .catch(() => { /* sin lista no se pinta el filtro, y la pantalla sigue */ });
    return () => { vivo = false; };
  }, [puedeFiltrar, projectId]);

  return { gestoras, puedeFiltrar };
}
