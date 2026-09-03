/**
 * Comprobar un IBAN antes de guardarlo (#92).
 *
 * El campo era `z.string().max(40)`: entraba cualquier cosa. Comprobado
 * guardando `ES0011112222333344445555`, que tiene la pinta y la longitud de un
 * IBAN español y NO lo es — falla el digito de control. El CRM lo acepto sin
 * decir nada, y de un dato asi nadie se entera hasta que la transferencia
 * rebota.
 *
 * Importa mas de lo normal aqui: hay 45 tutores que cargar de golpe, con
 * comisiones ya generadas. Un digito mal en una carga masiva se descubre el dia
 * del pago.
 *
 * LO QUE NO HACE, Y ES DELIBERADO
 *
 * No obliga a que todo el mundo tenga IBAN. Hay tutores en Venezuela y en
 * Mexico —se les ve el prefijo en los telefonos— y esos paises NO usan IBAN:
 * Mexico paga por CLABE, 18 cifras. Rechazar lo que no sea IBAN dejaria sin
 * poder cobrar justo a quien mas cuesta pagar, que es lo contrario de para lo
 * que existe esta tarea.
 *
 * Asi que solo se comprueba lo que DICE ser un IBAN: dos letras de pais, dos
 * cifras de control y el resto alfanumerico. Lo demas se guarda tal cual.
 */

/**
 * El resto de dividir el IBAN entre 97, como manda la norma ISO 13616:
 * se mueven los cuatro primeros caracteres al final, cada letra se convierte en
 * dos cifras (A=10 … Z=35) y el numero entero tiene que dar resto 1.
 *
 * Se hace cifra a cifra porque el numero resultante tiene hasta 38 digitos y no
 * cabe en un `Number` sin perder precision — con `parseInt` daria validos por
 * malos y al reves.
 */
function restoDe(iban) {
  const movido = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const caracter of movido) {
    const cifras = /[0-9]/.test(caracter)
      ? caracter
      : String(caracter.charCodeAt(0) - 55);
    for (const cifra of cifras) resto = (resto * 10 + Number(cifra)) % 97;
  }
  return resto;
}

/** Sin espacios y en mayusculas, que es como se compara y como se guarda. */
export const normalizarIban = (valor) =>
  String(valor || '').replace(/[\s-]/g, '').toUpperCase();

/** ¿Esto dice ser un IBAN? Dos letras, dos cifras y el resto alfanumerico. */
export const pareceIban = (valor) =>
  /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(normalizarIban(valor));

/**
 * ¿Es un IBAN valido? Solo se pronuncia sobre lo que parece un IBAN.
 *
 * Devuelve true para una CLABE o un numero de cuenta suelto: no son IBAN y esta
 * funcion no tiene nada que decir de ellos.
 */
export function ibanValido(valor) {
  const iban = normalizarIban(valor);
  if (!iban) return true;                 // vacio es borrar, no es un error
  if (!pareceIban(iban)) return true;     // no dice ser un IBAN
  return restoDe(iban) === 1;
}
