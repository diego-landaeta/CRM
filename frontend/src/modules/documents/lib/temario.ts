/**
 * Partir el temario de un producto en módulos, para el certificado (#43).
 *
 * `products.modulos_texto` es un bloque de texto **raspado de la web** por el
 * importador de WooCommerce, no una lista estructurada. Dentro vienen los
 * módulos marcados con «Módulo 1», «MÓDULO 2», «Modulo 3»… que es el mismo
 * patrón que ya usa el importador para contarlos:
 *
 *     wc.controller.js:559   /\bM[oó]dulo\s+\d+\b/gi
 *
 * Aquí se reutiliza ese patrón para CORTAR en vez de para contar, de modo que
 * si un día cambia el formato, cambia en los dos sitios a la vez.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTO PROPONE, NO DECIDE
 *
 * El texto de origen es de una web, así que no hay forma de garantizar que
 * salga bien en todos los cursos. Por eso lo que devuelve va a los campos
 * EDITABLES del formulario: quien emite el certificado ve los módulos antes de
 * generarlo y los corrige si el corte salió torcido.
 *
 * Un parser silencioso sobre texto raspado acaba imprimiendo basura en un
 * documento que se le entrega a un alumno; uno que rellena un formulario a la
 * vista, no.
 */

/** El marcador de módulo. Mismo patrón que el importador. */
const MARCADOR = /\bM[OÓoó][Dd][Uu][Ll][Oo]\s+\d+\b/g;

/** Líneas que no son parte del temario y ensucian el corte. */
const RUIDO = /^(temario|contenidos?|programa|plan de estudios|índice)\s*:?\s*$/i;

/**
 * Los módulos que haya en el texto, en orden y ya limpios.
 *
 * Devuelve `[]` si no encuentra ninguno — y eso es una respuesta válida, no un
 * fallo: hay cursos cuyo temario no está numerado. El formulario se queda como
 * estaba y se escriben a mano, que es lo que se hace hoy con todos.
 */
export function modulosDelTemario(texto?: string | null): string[] {
  if (!texto || typeof texto !== 'string') return [];

  const limpio = texto
    .replace(/<[^>]+>/g, '\n')      // por si el raspado se trajo etiquetas
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '');

  // Dónde empieza cada módulo. Sin `matchAll` sobre una regex con /g reutilizada
  // el índice se arrastra entre llamadas, así que se clona.
  const marcas = [...limpio.matchAll(new RegExp(MARCADOR, 'gi'))];
  if (!marcas.length) return [];

  const trozos: string[] = [];
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].index ?? 0;
    const hasta = i + 1 < marcas.length ? (marcas[i + 1].index ?? limpio.length) : limpio.length;
    trozos.push(limpio.slice(desde, hasta));
  }

  return trozos
    .map((t) => {
      // Se quita el «Módulo N» y lo que lo separe de su título: dos puntos, un
      // guion o un salto. El número ya lo pone el PDF al pintar la lista, así
      // que dejarlo sería «Módulo 1: Módulo 1: Fundamentos».
      const sinMarca = t.replace(new RegExp('^' + MARCADOR.source + '\\s*[:.\\-–—]?\\s*', 'i'), '');
      return sinMarca
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !RUIDO.test(l))
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    })
    .filter(Boolean);
}

/**
 * Las horas del curso, como número escrito.
 *
 * `products.horas` es texto libre —«750», «750 horas», «750h»— porque viene de
 * la misma web. El certificado ya escribe «Por un total de X horas», así que
 * mandarle «750 horas» imprimiría «750 horas horas».
 */
export function horasDelProducto(horas?: string | null, duracion?: string | null): string {
  for (const fuente of [horas, duracion]) {
    const n = String(fuente || '').match(/\d[\d.]*/);
    if (n) return n[0].replace(/\./g, '');
  }
  return '';
}
