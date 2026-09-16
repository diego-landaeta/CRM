import Select from '@/shared/components/ui/Select';
import type { Gestora } from '@/shared/hooks/useGestoras';

/**
 * «Todo el equipo» o una gestora (#130, punto 1).
 *
 * Va con la primitiva `Select` del rediseño, no con un `<select>` del
 * navegador. El punto 4 del ticket lo pide con nombre y apellido —«que salga
 * de sus piezas», las de @ArepaConQuesoxd en el #78/#79— y el dashboard es
 * justo la pantalla donde peor sienta ir por libre.
 *
 * La cola del día (#90) sí lleva uno crudo. Copiarlo habría sido replicar una
 * desviación en vez de seguir el ticket; cuando se pase esa pantalla, este
 * componente ya está para las dos.
 *
 * Con la lista vacía no se pinta nada: un desplegable con una sola opción no
 * filtra, ocupa sitio y promete algo que no hace.
 */
export default function SelectorDeGestora({
  valor,
  alCambiar,
  gestoras,
}: {
  valor: number | null;
  alCambiar: (id: number | null) => void;
  gestoras: Gestora[];
}) {
  if (!gestoras.length) return null;

  // `Select` es genérico sobre el valor, pero «todo el equipo» no es un id.
  // Viaja como cadena vacía y se traduce en el borde, que es el único sitio
  // donde hay que acordarse de ello.
  const TODAS = '';

  return (
    <Select<string>
      value={valor === null ? TODAS : String(valor)}
      onChange={(v) => alCambiar(v === TODAS ? null : Number(v))}
      options={[
        { value: TODAS, label: 'Todo el equipo' },
        ...gestoras.map((g) => ({ value: String(g.id), label: g.nombre })),
      ]}
      size="sm"
      ariaLabel="Filtrar por gestora"
    />
  );
}
