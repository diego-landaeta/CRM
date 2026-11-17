import { useEffect, useState } from 'react';
import { getEstado, type CampusZadarma } from '../api/zadarma.api';

/**
 * Zadarma en un campus para quien está mirando:
 *   · null       → ese campus no tiene Zadarma (o aún no se sabe): sin botón;
 *   · { extension: null } → conectado, pero esta persona no tiene extensión;
 *   · { extension: '101' } → puede llamar.
 */
export function useZadarma(projectId: number | null | undefined): CampusZadarma | null {
  const [campus, setCampus] = useState<CampusZadarma | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!projectId) { setCampus(null); return undefined; }
    getEstado().then((lista) => {
      if (vivo) setCampus(lista.find((c) => c.project_id === Number(projectId)) ?? null);
    });
    return () => { vivo = false; };
  }, [projectId]);
  return campus;
}
