import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * El puente de Baileys no puede servir nada que Evolution no sirva (#63).
 *
 * En local se usa un puente propio porque Docker no arranca en todas las
 * maquinas. En produccion se habla con Evolution v2 directamente. Si el puente
 * es MAS GENEROSO que el original, lo que se prueba no es lo que corre — y el
 * fallo aparece en produccion, que es donde mas caro sale.
 *
 * Ya paso dos veces:
 *
 *  · `/agenda` y `GET /chat/presence/…` solo existian en el puente. En
 *    produccion devolvian 404, y el de la presencia se pedia cada cinco
 *    segundos por chat abierto: 136 errores en diez minutos, enterrando los
 *    errores de verdad.
 *  · El autor de un mensaje de grupo se leia de `datos.participante`, que manda
 *    el puente, y Evolution lo pone en `key.participant`: en produccion el
 *    autor quedaba siempre vacio mientras en local se veia bien.
 *
 * Esta prueba compara las dos listas y no deja que se separen. Es la tercera
 * peticion del #63: «que en tu puente esos endpoints no existan tampoco».
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const CLIENTE = resolve(aqui, '../src/modules/whatsapp/evolution.client.js');
const PUENTE = resolve(aqui, '../../tools/puente-wa/puente.mjs');

/** Las direcciones que el CRM le pide a Evolution, sin la parte variable. */
function loQuePideElCrm() {
  const fuente = readFileSync(CLIENTE, 'utf8');
  const rutas = new Set();
  // `pedir('/instance/create')` y `pedir(`/chat/sendPresence/${nombre}`)`.
  for (const [, ruta] of fuente.matchAll(/pedir\(\s*[`'"]([^`'"$]+)/g)) {
    const limpia = ruta.replace(/\/+$/, '');
    if (limpia.startsWith('/')) rutas.add(limpia);
  }
  return [...rutas].sort();
}

/** Las que el puente atiende. */
function loQueSirveElPuente() {
  const fuente = readFileSync(PUENTE, 'utf8');
  const rutas = new Set();
  for (const [, ruta] of fuente.matchAll(/url(?:\s*===\s*|\.startsWith\(|\.includes\()\s*['"]([^'"]+)['"]/g)) {
    rutas.add(ruta.replace(/\/+$/, ''));
  }
  return [...rutas];
}

/** ¿Atiende el puente esta direccion? Compara por prefijo. */
const laAtiende = (ruta, servidas) =>
  servidas.some((s) => ruta === s || ruta.startsWith(s) || s.startsWith(ruta));

describe('el puente sirve lo mismo que Evolution, ni mas ni menos', () => {
  const pide = loQuePideElCrm();
  const sirve = loQueSirveElPuente();

  it('se leen las dos listas', () => {
    expect(pide.length, 'direcciones que pide el CRM').toBeGreaterThan(10);
    expect(sirve.length, 'direcciones que sirve el puente').toBeGreaterThan(10);
  });

  it('todo lo que el CRM pide, el puente lo atiende', () => {
    // Al reves —algo del puente que el CRM no pide— no es un problema: sobra,
    // pero no engaña a nadie. Lo que engaña es lo contrario.
    const huerfanas = pide.filter((r) => !laAtiende(r, sirve));
    expect(huerfanas, `el CRM las pide y el puente no las sirve:\n  ${huerfanas.join('\n  ')}`).toEqual([]);
  });

  it('no vuelve `/agenda`: el endpoint real es /chat/findContacts', () => {
    expect(pide).not.toContain('/agenda');
    expect(readFileSync(CLIENTE, 'utf8')).toContain('/chat/findContacts/');
  });

  it('no vuelve a preguntarse quien escribe: Evolution no lo deja', () => {
    // `sendPresence` es mandar la PROPIA, y esa si existe. Lo que no existe es
    // preguntar por la del otro.
    const fuente = readFileSync(CLIENTE, 'utf8');
    expect(fuente).not.toMatch(/pedir\(\s*[`'"]\/chat\/presence\//);
  });
});
