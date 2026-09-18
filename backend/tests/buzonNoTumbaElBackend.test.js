import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Un corte de red leyendo el correo NO puede cerrar el backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PASO DE VERDAD, EL 18/09/2026
 *
 *   FATAL: Excepcion sin capturar — se cierra
 *   Error: read ECONNRESET at TLSWrap.onStreamRead
 *   WARN: Correo entrante: no se pudo leer el buzón (imap.hostinger.com)
 *   [exited with code 1]
 *
 * El backend se fue entero porque el servidor de correo cortó una conexión.
 *
 * Por qué el try/catch no bastaba: ese error llega como evento 'error' del
 * cliente de IMAP, no como rechazo de la promesa que se está esperando. Sin
 * nadie escuchándolo, Node lo trata como excepción sin capturar y el manejador
 * de `app.js` cierra el proceso a propósito —que es lo correcto para un fallo
 * de programación, y aquí no lo era—.
 *
 * En producción lo tapa PM2 reiniciando, y por eso no se había notado: el
 * síntoma es la API cayéndose unos segundos cada cierto tiempo, sin más pista.
 */

const ficheros = [
  'correo-entrante.service.js',
  'copia-en-enviados.service.js',
];

describe('los clientes de IMAP', () => {
  for (const f of ficheros) {
    it(`${f} escucha los errores de su socket`, () => {
      const src = readFileSync(
        new URL(`../src/shared/services/${f}`, import.meta.url), 'utf8');

      // Que haya cliente de IMAP, o esta prueba no comprueba nada.
      expect(src).toMatch(/new ImapFlow\(/);
      expect(src).toMatch(/cliente\.on\('error'/);
    });

    it(`${f} lo escucha ANTES de conectar`, () => {
      // Puesto después de `connect()`, un corte durante el propio connect
      // vuelve a tumbar el proceso: la ventana es justo esa.
      const src = readFileSync(
        new URL(`../src/shared/services/${f}`, import.meta.url), 'utf8');
      expect(src.indexOf("cliente.on('error'")).toBeLessThan(src.indexOf('cliente.connect()'));
    });
  }
});

/**
 * Y el manejador que cierra el proceso no puede matar la SUITE.
 *
 * Los ficheros de prueba importan `app.js`, así que ese manejador acaba
 * instalado dentro del worker de Vitest. Cualquier excepción suelta —un
 * socket que se cae, una consulta contra un pool que otro fichero ya cerró—
 * mataba el worker entero: «Worker exited unexpectedly», veinte pruebas sin
 * ejecutar y ninguna roja que señalara nada. Pasó hoy, tres veces.
 */
describe('el manejador de excepciones', () => {
  it('no cierra el proceso cuando corren las pruebas', () => {
    const src = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
    const i = src.indexOf("uncaughtException");
    expect(i).toBeGreaterThan(-1);
    const bloque = src.slice(i, i + 1200);
    // La guarda va ANTES del exit, o no sirve de nada.
    expect(bloque.indexOf('process.env.VITEST')).toBeLessThan(bloque.indexOf('process.exit'));
  });

  it('fuera de las pruebas sigue saliendo', () => {
    // Ahí el proceso puede haber quedado a medias y PM2 lo levanta. Quitar el
    // exit del todo sería dejar el backend sirviendo en un estado roto.
    const src = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
    expect(src).toMatch(/process\.exit\(1\)/);
  });
});
