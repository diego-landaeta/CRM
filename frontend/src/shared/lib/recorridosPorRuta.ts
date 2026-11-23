import { matchPath } from 'react-router-dom';
import { RECORRIDOS_COBROS, type IdRecorridoCobros } from '@/shared/lib/recorridosCobros';

/*
  EL REGISTRO RUTA → RECORRIDO (CRM#1012).

  Para que el botón «Recorrido» de la cabecera sepa cuál toca en cada pantalla.
  Sale de las `rutas` que declara cada recorrido (en su propio fichero, junto a
  sus pasos): así un recorrido nuevo se ofrece solo, sin tocar otra lista.

  Las rutas, como en `App.jsx` (con `:id`). Una pantalla puede tener varios
  (la ficha de la venta: cuotas, links, cobro automático, cargos sueltos).
*/

/** La tabla entera, ruta → ids, en el orden en que se declaran. */
export function tablaDeRutas(): Array<[string, IdRecorridoCobros[]]> {
  const tabla = new Map<string, IdRecorridoCobros[]>();
  for (const r of Object.values(RECORRIDOS_COBROS)) {
    for (const ruta of r.rutas || []) {
      const ids = tabla.get(ruta) || [];
      ids.push(r.id);
      tabla.set(ruta, ids);
    }
  }
  return [...tabla.entries()];
}

/** Los recorridos de la pantalla en la que se está (sin repetir). */
export function recorridosDeLaRuta(pathname: string): IdRecorridoCobros[] {
  const limpio = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const out: IdRecorridoCobros[] = [];
  for (const [ruta, ids] of tablaDeRutas()) {
    if (matchPath({ path: ruta, end: true }, limpio)) out.push(...ids);
  }
  return [...new Set(out)];
}
