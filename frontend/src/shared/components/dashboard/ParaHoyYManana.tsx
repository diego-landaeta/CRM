import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warning, Sun, CalendarBlank, CalendarCheck } from '@phosphor-icons/react';
import { traerResumen, type ResumenCola } from '@/modules/proceso/api/agenda.api';
import { Acta, CampoActa } from '@/shared/components/ui/Acta';

/**
 * «Para hoy / para mañana» (#130, parte 2).
 *
 * Diego: «añadir el para hoy, el para mañana y así, según sus notificaciones y
 * todo lo que guarden». El ticket avisa de que no es una lista mas: es QUE HAY
 * QUE HACER, y es lo que convierte el dashboard en la primera pantalla que se
 * abre por la mañana.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO CUENTA NADA: se lo pregunta a la cola
 *
 * Los cuatro numeros salen de `GET /api/proceso/cola/resumen`, que dejo hecho
 * Diego el 08/09 y que YA recorta por rol —una gestora recibe lo suyo, quien
 * manda recibe todo o el de una con `?gestoraId=`—. Contar aqui por mi cuenta
 * seria una segunda contabilidad de la misma cola: el dia que discrepen, el
 * dashboard y la cola dirian numeros distintos de lo mismo.
 *
 * CADA NUMERO ES UN ENLACE, Y ESO ES LA MITAD DEL TRABAJO
 *
 * El #132 lo dejo escrito: «un aviso que dice "mañana tienes 12" y te deja
 * buscandolos no sirve de nada». Por eso el tramo de la cola vive ahora en la
 * direccion, y estos enlaces dejan la lista ya puesta en el tramo que se pulsa.
 */

type Tramo = {
  /** Lo que viaja en la direccion: `?tramo=hoy`. */
  clave: 'atrasados' | 'hoy' | 'manana' | 'semana';
  rotulo: string;
  icono: typeof Warning;
  /** De que campo del resumen sale el numero, cuando no se llama igual. */
  campo: keyof ResumenCola;
  /** Los atrasados se pintan en ambar: es el unico tramo que ya va tarde. */
  urge?: boolean;
};

const TRAMOS: Tramo[] = [
  { clave: 'atrasados', rotulo: 'Atrasados', icono: Warning, campo: 'atrasados', urge: true },
  { clave: 'hoy', rotulo: 'Para hoy', icono: Sun, campo: 'hoy' },
  { clave: 'manana', rotulo: 'Para mañana', icono: CalendarBlank, campo: 'manana' },
  { clave: 'semana', rotulo: 'Esta semana', icono: CalendarCheck, campo: 'esta_semana' },
];

// `projectIds` es la lista de campus cuando hay una EMPRESA puesta: la cola
// del proceso ya sabia recibir varios, lo que faltaba era pasarselos.
export default function ParaHoyYManana(
  { projectId, projectIds = null }: { projectId?: number | null; projectIds?: string | null },
) {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenCola | null>(null);

  useEffect(() => {
    let vivo = true;
    traerResumen({ projectId, projectIds })
      .then((r) => { if (vivo) setResumen(r); })
      .catch(() => { if (vivo) setResumen(null); });
    return () => { vivo = false; };
  }, [projectId, projectIds]);

  if (!resumen) return null;

  // Si no hay nada pendiente en ningun tramo, el bloque sobra: un dashboard
  // lleno de ceros entrena a no mirarlo.
  const algo = TRAMOS.some((t) => Number(resumen[t.campo] ?? 0) > 0);
  if (!algo) return null;

  // Rediseño (20/11): un acta de cuatro celdas, 56 px, en vez de un bloque de
  // 160 con título y explicación. La explicación va en el `title` de cada celda.
  return (
    <Acta etiqueta="Lo que toca, del proceso comercial" min={120}>
      {TRAMOS.map(({ clave, rotulo, icono: Icono, urge, campo }) => {
        const n = Number(resumen[campo] ?? 0);
        return (
          <CampoActa
            key={clave}
            icon={Icono}
            etiqueta={rotulo}
            valor={n}
            tono={urge && n > 0 ? 'aviso' : 'neutro'}
            title={`${rotulo}: ${n}. Pulsa y la cola se abre en este tramo.`}
            ariaLabel={`${rotulo}: ${n}. Abrir la cola en este tramo`}
            onClick={() => navigate(`/prospectos/cola?tramo=${clave}`)}
          />
        );
      })}
    </Acta>
  );
}
