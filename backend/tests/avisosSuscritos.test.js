import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EVENTOS_QUE_ATENDEMOS } from '../src/modules/whatsapp/evolution.client.js';

/**
 * Lo que el CRM sabe atender y lo que Evolution le manda tienen que coincidir.
 *
 * Al crear una sesion con webhook propio se pedian tres avisos: MESSAGES_UPSERT,
 * MESSAGES_UPDATE y CONNECTION_UPDATE. Los manejadores de los otros existian,
 * estaban probados y no se ejecutaban NUNCA, porque nadie se habia suscrito.
 *
 * Lo que eso tumbaba, comprobado contra la instancia de la prueba:
 *
 *   CALL            — ni una llamada entrante en todo el CRM.
 *   CONTACTS_UPDATE — ninguna foto de perfil; se ven las iniciales siempre.
 *   MESSAGES_DELETE — «eliminé un mensaje y no se eliminó», tal cual se reporto.
 *   GROUPS_UPSERT   — el asunto de un grupo al crearlo o renombrarlo.
 *
 * Y solo pasaba con el webhook propio puesto: o sea SOLO en produccion y
 * staging. En local se cae al webhook global del contenedor, que los manda
 * todos, asi que aqui se veia bien. Es el peor sitio donde puede esconderse un
 * fallo, y por eso esto se comprueba leyendo el codigo en vez de fiarse.
 */

const servicio = readFileSync(
  new URL('../src/modules/whatsapp/chat.service.js', import.meta.url), 'utf8'
);

/**
 * Los nombres que pide Evolution para una rama: `contacts[._](update|upsert)`
 * son CONTACTS_UPDATE y CONTACTS_UPSERT. Basta con que UNO este suscrito.
 */
const comoLoPideEvolution = (patron) => {
  const alternativa = /\(([a-z|]+)\)/.exec(patron);
  const base = patron.replace(/\[\._\]/g, '_').replace(/\([a-z|]+\)/, '');
  const colas = alternativa ? alternativa[1].split('|') : [''];
  return colas.map((c) => (base + c).replace(/[^a-z_]/gi, '').toUpperCase());
};

describe('cada aviso que se atiende, suscrito', () => {
  // Las ramas de `recibir()`: `if (/messages[._]update/i.test(evento))`.
  const atendidos = [...servicio.matchAll(/\/\^?([a-z]+(?:\[\._\][a-z()|]+)?)\$?\/i\.test\(evento\)/g)]
    .map((m) => comoLoPideEvolution(m[1]));

  it('se encuentran las ramas del webhook', () => {
    // Si esto se rompe, el resto del fichero deja de comprobar nada.
    expect(atendidos.length).toBeGreaterThanOrEqual(4);
  });

  it('los borrados', () => {
    expect(EVENTOS_QUE_ATENDEMOS, 'borrar «para mi» no llegaba nunca').toContain('MESSAGES_DELETE');
  });

  it('las llamadas', () => {
    expect(EVENTOS_QUE_ATENDEMOS, 'no entraba ni una llamada').toContain('CALL');
  });

  it('las fotos de perfil', () => {
    expect(EVENTOS_QUE_ATENDEMOS, 'nadie tenia foto').toContain('CONTACTS_UPDATE');
  });

  it('y el mensaje normal, que es el que si estaba', () => {
    expect(EVENTOS_QUE_ATENDEMOS).toContain('MESSAGES_UPSERT');
  });

  it('no queda ninguna rama sin su aviso', () => {
    // `history.progress` lo manda el puente por su cuenta, no es un evento de
    // Evolution: se excluye a proposito y se nombra para que se vea que no es
    // un olvido.
    const delPuente = ['HISTORY_PROGRESS'];
    const huerfanos = atendidos
      .filter((nombres) => !nombres.some(
        (e) => EVENTOS_QUE_ATENDEMOS.includes(e) || delPuente.includes(e)
      ))
      .map((nombres) => nombres.join('/'));
    expect(huerfanos, `hay manejadores que no reciben nada: ${huerfanos.join(', ')}`).toEqual([]);
  });
});

describe('lo que se pide al crear una sesion', () => {
  const cliente = readFileSync(
    new URL('../src/modules/whatsapp/evolution.client.js', import.meta.url), 'utf8'
  );

  it('es la lista entera, no una copia escrita a mano', () => {
    // Con la lista escrita dos veces, anadir un manejador arregla una y olvida
    // la otra — que es exactamente como empezo esto.
    expect(cliente).toContain('events: EVENTOS_QUE_ATENDEMOS');
  });
});
