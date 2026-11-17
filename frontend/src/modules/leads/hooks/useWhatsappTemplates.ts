import { useEffect, useState } from 'react';
import client from '@/shared/api/client';
import type { Lead } from '@/shared/types';
import { rellenar } from '@/modules/whatsapp/lib/plantilla';

// Las plantillas de WhatsApp, leídas de la base de datos.
//
// Antes vivían en el localStorage del navegador, y eso traía dos problemas:
// cada gestora tenía las suyas en su equipo —nadie podía revisarlas y si
// cambiaba de ordenador las perdía— y los dos CRMs las guardaban con formatos
// distintos que ni siquiera coincidían entre sí.
//
// Aquí solo se leen. Crear, cambiar y borrar vive en la pantalla de Plantillas,
// para que no haya dos sitios donde editar lo mismo.

export interface WhatsappTemplate {
  id: number | string;
  label: string;
  text: string;
  ambito?: 'compartida' | 'personal';
}

interface FilaApi {
  id: number;
  label: string;
  body: string;
  ambito: 'compartida' | 'personal';
}

export function useWhatsappTemplates(projectId: number | string | null | undefined) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);

  useEffect(() => {
    // -1 es «Todos los proyectos» del selector: no hay plantillas que traer.
    const pid = Number(projectId);
    if (!pid || pid === -1) { setTemplates([]); return undefined; }

    let vivo = true;
    client.get(`/whatsapp/templates?projectId=${pid}`)
      .then((r) => {
        if (!vivo) return;
        const filas = (r.success ? (r.data as FilaApi[] | undefined) : undefined) || [];
        // El campo se llama `body` en la base y `text` en las pantallas viejas.
        setTemplates(filas.map((t) => ({ id: t.id, label: t.label, text: t.body, ambito: t.ambito })));
      })
      .catch(() => { if (vivo) setTemplates([]); });
    return () => { vivo = false; };
  }, [projectId]);

  return { templates };
}

/** Subset de Lead que fillTemplate consume (laxo para aceptar tipos parciales). */
export type FillTemplateLead = Pick<Partial<Lead>, 'nombre' | 'producto_nombre' | 'producto_interes' | 'email' | 'telefono'>;

/**
 * Reemplaza variables en el template con los datos del lead.
 *
 * Con el MISMO motor que el chat y la cola (`rellenar`), no con uno propio.
 * Este tenía su lista de huecos a mano y se quedaba atrás cada vez que el otro
 * aprendía uno: no rellenaba `{teléfono}` con tilde ni `{comercial}` (#129), y
 * los copiaba tal cual al portapapeles.
 */
export function fillTemplate(
  text: string,
  { lead, projectName, comercial }: { lead?: FillTemplateLead | null; projectName?: string; comercial?: string | null },
): string {
  return rellenar(text, {
    nombre: lead?.nombre,
    email: lead?.email,
    telefono: lead?.telefono,
    producto: lead?.producto_nombre || lead?.producto_interes || 'nuestros servicios',
    comercial,
  }, projectName);
}
