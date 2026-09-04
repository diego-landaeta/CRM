import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

/**
 * En el testigo de sesion el usuario se llama `userId`, no `id`.
 *
 * Lo pone `generateAccessToken`:
 *
 *     jwt.sign({ userId: user.id, email, role, ... })
 *
 * y `verifyToken` deja ese objeto tal cual en `req.user`. Asi que `req.user.id`
 * es SIEMPRE undefined. No falla: se guarda un NULL y sigue.
 *
 * Habia quince sitios asi en nueve modulos, y cada uno perdia algo distinto:
 * quien creo una audiencia, un documento, un formulario o una nomina; quien
 * valido una matricula; quien lanzo una sincronizacion de WooCommerce. En el
 * chat de IA era peor — el tope de mensajes por hora contaba los de
 * `undefined`, o sea que no limitaba a nadie, y la comprobacion de dueño de una
 * conversacion se hacia contra undefined.
 *
 * Los tipos no cazan esto porque el backend es JavaScript, y ninguna prueba lo
 * cazaba porque nada falla. Esta lo mira en el codigo, que es donde se ve.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(aqui, '../src');

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheros(p) : (n.endsWith('.js') ? [p] : []);
  });
}

describe('el usuario del testigo se llama userId', () => {
  it('nadie lee `req.user.id`', () => {
    const culpables = [];
    for (const p of ficheros(SRC)) {
      const lineas = readFileSync(p, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        // `req.user.id` seguido de algo que no sea una letra o un digito: asi
        // `req.user.identidad` no cuenta, pero `req.user.id,` y `req.user.id)`
        // si. Se saltan los comentarios, que hablan justamente de esto.
        const esComentario = /^\s*(\/\/|\*|\/\*)/.test(linea);
        if (!esComentario && /req\.user\.id(?![A-Za-z0-9_])/.test(linea)) {
          culpables.push(`${relative(SRC, p)}:${i + 1}`);
        }
      });
    }
    expect(culpables, `usan req.user.id, que no existe:\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('y el testigo sigue firmandose con userId', () => {
    // Si algun dia se renombra en el token, esta prueba avisa antes de que
    // 132 sitios se queden leyendo un campo que ya no viene.
    const auth = readFileSync(resolve(SRC, 'modules/auth/auth.service.js'), 'utf8');
    expect(auth).toMatch(/jwt\.sign\(\s*\{\s*userId:/);
  });
});
