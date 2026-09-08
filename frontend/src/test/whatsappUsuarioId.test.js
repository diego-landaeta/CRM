import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Que NINGUNA llamada del chat se olvide de decir de quien es la sesion.
//
// Este descuido ha aparecido SIETE veces, siempre igual y siempre en silencio:
// un administrador abre el WhatsApp de una gestora, hace algo, y el servidor lo
// busca en la sesion del propio administrador. La respuesta es «conversacion no
// encontrada» — un 404 que el frontal se traga con un aviso pequeño.
//
//   · Las cinco primeras las cazo Diego al juntar las ramas: abrir por
//     prospecto, abrir por telefono, adjuntar, descargar adjunto y «no me
//     escribas».
//   · La sexta fue la ficha del prospecto, y salio abriendo el popup en el
//     navegador.
//   · La septima fue apuntar la llamada, y ahi el sintoma no era un error
//     visible sino CERO llamadas registradas en pruebas mientras el boton
//     parecia funcionar. Es la tarea #67.
//
// Repasar esto a ojo no funciona: ya se ha demostrado siete veces. Asi que se
// comprueba leyendo el fichero — no hay forma de montar «todas las llamadas
// futuras» de otra manera.

// Desde la raiz del proyecto: `import.meta.url` no es una ruta de fichero en el
// entorno de pruebas.
const api = readFileSync(
  resolve(process.cwd(), 'src/modules/whatsapp/api/whatsapp.api.ts'),
  'utf8'
);

/**
 * Las funciones de `chatApi` que trabajan sobre UNA conversacion concreta.
 *
 * Son las que pasan por `miConversacion(req, id)` en el servidor, que es donde
 * se compara la sesion. Las que no tocan una conversacion —las plantillas, por
 * ejemplo— no lo necesitan.
 */
const SOBRE_UNA_CONVERSACION = [
  'hilo',
  'enviar',
  'adjunto',
  'ficha',
  'apuntarLlamada',
  'noEscribir',
  'descargarAdjunto',
];

describe('de quien es la sesion, en todas las llamadas del chat', () => {
  for (const nombre of SOBRE_UNA_CONVERSACION) {
    it(`${nombre} manda usuarioId`, () => {
      // Se coge desde el nombre de la funcion hasta la siguiente, que es su
      // cuerpo entero: firma y llamada al cliente.
      const i = api.indexOf(`\n  ${nombre}:`);
      expect(i, `no se encontro chatApi.${nombre} — ¿se renombro?`).toBeGreaterThan(-1);
      const trozo = api.slice(i, i + 700);
      const fin = trozo.search(/\n\s{2}[a-zA-Z]+:\s*\(/);
      const cuerpo = fin > 0 ? trozo.slice(0, fin) : trozo;

      expect(
        cuerpo.includes('usuarioId'),
        `chatApi.${nombre} no manda usuarioId. Con la sesion de otra persona ` +
        'elegida, el servidor buscara en la del propio administrador y ' +
        'contestara «conversacion no encontrada» — normalmente sin que se note. ' +
        'Ha pasado siete veces; ver la cabecera de este fichero.'
      ).toBe(true);
    });
  }

  it('el listado tambien, que es de donde sale todo', () => {
    const i = api.indexOf('\n  lista:');
    expect(api.slice(i, i + 300).includes('usuarioId')).toBe(true);
  });
});
