import { describe, it, expect } from 'vitest';
import { ibanValido, pareceIban, normalizarIban } from '../src/shared/utils/iban.js';

/**
 * Un IBAN mal escrito no se descubre hasta que rebota la transferencia (#92).
 *
 * El campo era `z.string().max(40)`: entraba cualquier cosa. Se comprobo
 * guardando `ES0011112222333344445555` desde la propia pantalla — tiene la
 * pinta y la longitud de un IBAN español, no lo es, y el CRM lo acepto sin
 * decir nada.
 *
 * Con 45 tutores que cargar de golpe y comisiones ya generadas, un digito mal
 * en la carga se paga el dia del pago.
 */

describe('lo que si es un IBAN', () => {
  it('uno español bueno pasa', () => {
    expect(ibanValido('ES9121000418450200051332')).toBe(true);
  });

  it('con espacios, como se copia del banco', () => {
    expect(ibanValido('ES91 2100 0418 4502 0005 1332')).toBe(true);
  });

  it('uno aleman tambien: esto no es solo de España', () => {
    expect(ibanValido('DE89370400440532013000')).toBe(true);
  });

  it('en minusculas vale igual', () => {
    expect(ibanValido('es9121000418450200051332')).toBe(true);
  });
});

describe('lo que NO pasa', () => {
  it('el que se colo en la prueba de pantalla', () => {
    expect(ibanValido('ES0011112222333344445555'), 'esto se guardo tal cual').toBe(false);
  });

  it('un digito cambiado', () => {
    expect(ibanValido('ES9121000418450200051333')).toBe(false);
  });

  it('dos cifras intercambiadas, que es el error de tecleo tipico', () => {
    expect(ibanValido('ES9112000418450200051332')).toBe(false);
  });

  it('uno al que le falta una cifra', () => {
    expect(ibanValido('ES912100041845020005133')).toBe(false);
  });
});

describe('lo que NO se juzga, y es a proposito', () => {
  // Hay tutores en Venezuela y en Mexico. Mexico paga por CLABE —18 cifras— y
  // ni ese pais ni Venezuela usan IBAN. Rechazarlos dejaria sin cobrar
  // justo a quien mas cuesta pagar.

  it('una CLABE mexicana se acepta', () => {
    expect(pareceIban('032180000118359719')).toBe(false);
    expect(ibanValido('032180000118359719')).toBe(true);
  });

  it('un numero de cuenta suelto tambien', () => {
    expect(ibanValido('0102-0552-21-0000123456')).toBe(true);
  });

  it('y vacio no es un error: es borrar el campo', () => {
    expect(ibanValido('')).toBe(true);
    expect(ibanValido(null)).toBe(true);
    expect(ibanValido(undefined)).toBe(true);
  });
});

describe('como se guarda', () => {
  it('sin espacios ni guiones y en mayusculas', () => {
    expect(normalizarIban(' es91 2100-0418 4502 0005 1332 ')).toBe('ES9121000418450200051332');
  });
});
