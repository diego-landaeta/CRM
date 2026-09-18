/**
 * Las reglas del documento comercial que el CRM puede comprobar solo (#91).
 *
 * El documento trae reglas que hoy dependen de que alguien se acuerde. Las que
 * el CRM puede mirar con datos que ya tiene se miran aqui, y la pantalla las
 * dice en el sitio y en el momento en que hacen falta —no en un manual—.
 *
 * NINGUNA IMPIDE NADA. Dicen lo que toca; la gestora decide. Una regla que
 * bloquea con un dato incompleto se salta por otro lado el mismo dia.
 */

/**
 * ¿Lleva el 5 % de contado esta formacion?
 *
 * El documento: «el 5 % solo aplica en master y diplomado, y se ofrece en el
 * paso 3, no antes». Hoy depende de que cada asesora sepa de que tipo es cada
 * formacion, y el CRM lo sabe: esta en la categoria del catalogo y, casi
 * siempre, en el propio nombre.
 *
 * Devuelve `true` / `false` / `null`, y el NULL importa: sin formacion elegida
 * no se sabe, y decir «no aplica» ahi es peor que callarse —se pierde un
 * descuento legitimo y nadie se entera—. La pantalla dice «no consta la
 * formacion» en ese caso.
 */
export function llevaCincoDeContado(producto, categoria) {
  const texto = `${producto || ''} ${categoria || ''}`.trim();
  if (!texto) return null;
  return /\b(master|maestria|diplomado)s?\b/i.test(quitaTildes(texto));
}

/**
 * Sin tildes, porque el catalogo las escribe de las dos formas.
 *
 * «Máster en Neuroeducación» y «Master Neuroeducacion» son la misma cosa, y en
 * produccion conviven: unos productos llegaron de WordPress y otros se
 * escribieron a mano.
 */
function quitaTildes(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
