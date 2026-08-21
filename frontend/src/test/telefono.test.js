import { describe, it, expect } from 'vitest';
import { normalizarTelefono, telefonoParaWhatsapp } from '@/shared/lib/telefono';

// El criterio de telefonos del navegador, que es el mismo que el del backend.
//
// Antes cada pantalla llevaba su propio `cleanPhone` —habia tres, y no
// coincidian entre si— que se limitaba a tirar lo que no fuera un digito. Con
// eso se enseñaba el boton de WhatsApp para numeros que no podian funcionar, se
// pulsaba, y el chat no abria.

describe('normalizarTelefono', () => {
  it('deja en paz lo que ya viene bien', () => {
    expect(normalizarTelefono('+34600123456')).toBe('+34600123456');
  });

  it('quita separadores', () => {
    for (const bruto of ['+34 600 12 34 56', '+34-600-123-456', '+34 (600) 123.456', '+34·600·123456']) {
      expect(normalizarTelefono(bruto)).toBe('+34600123456');
    }
  });

  it('cambia el 00 internacional por el +, que es lo que rompia el enlace', () => {
    // Este es el caso del ticket: «un 0034… abre un chat roto». Tirar lo que no
    // sea digito dejaba «0034600123456», que no lleva a ninguna parte.
    expect(normalizarTelefono('0034 600 12 34 56')).toBe('+34600123456');
  });

  it('quita el .0 que mete Excel al guardar el telefono como numero', () => {
    expect(normalizarTelefono('34600123456.0')).toBe('+34600123456');
  });

  it('descarta lo que no es un telefono', () => {
    // Los formularios traen esto tal cual, y antes pasaba el filtro convertido
    // en cadena vacia o en digitos sueltos.
    for (const malo of ['No suministrado', 'no suministrado', '', '   ', null, undefined, 'abc']) {
      expect(normalizarTelefono(malo)).toBeNull();
    }
  });

  it('descarta lo demasiado corto para ser un numero', () => {
    // Con menos de siete digitos no hay telefono al que llamar. Antes «123»
    // pasaba y se enseñaba el boton.
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono('123456')).toBeNull();
    expect(normalizarTelefono('1234567')).toBe('+1234567');
  });

  it('quita los ceros de delante', () => {
    expect(normalizarTelefono('00034600123456')).toBe('+34600123456');
  });
});

describe('telefonoParaWhatsapp', () => {
  it('devuelve los digitos sin el +, que es lo que quiere wa.me', () => {
    expect(telefonoParaWhatsapp('+34 600 12 34 56')).toBe('34600123456');
  });

  it('devuelve null cuando no hay numero utilizable, para no enseñar el boton', () => {
    expect(telefonoParaWhatsapp('No suministrado')).toBeNull();
    expect(telefonoParaWhatsapp('123')).toBeNull();
  });
});
