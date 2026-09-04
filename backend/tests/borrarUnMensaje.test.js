import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Un mensaje borrado en el movil tiene que verse borrado en el CRM.
 *
 * Se probo con el numero de verdad: se elimino un mensaje «para mi» desde el
 * telefono y en el CRM siguio igual. Un borrado que no se refleja es de lo peor
 * que puede hacer esto — el mensaje sigue ahi para quien mira el CRM y ya no
 * existe para quien mira el movil.
 *
 * Habia dos cosas, y las dos estaban:
 *
 *  1. El evento `MESSAGES_DELETE` no estaba suscrito con webhook propio, o sea
 *     que en produccion no llegaba nunca. Eso se fija en `avisosSuscritos`.
 *
 *  2. Y aunque llegara, faltaba la forma con la que viene. Comprobado en el
 *     Baileys que corre DENTRO de Evolution v2.3.7 — `chat-utils.js`:
 *
 *         ev.emit('messages.delete', { keys: [{ remoteJid, id, fromMe }] })
 *
 *     La clave cuelga de `keys`, no del objeto de arriba. Se aceptaban el
 *     objeto suelto, la lista y la clave aplanada; esta se caia por el unico
 *     hueco que quedaba, y sin ruido: entraba y salia con cero marcados.
 */

const marcados = [];

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  usuarioDeInstancia: () => 1,
  instanciaDe: (id) => `crm-u${id}`,
  PREFIJO: 'crm',
  descargarMedia: async () => null,
  fotoDe: async () => null,
  grupoDe: async () => null,
  contactoDe: async () => null,
}));

vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  actualizarAvatar: async () => 0,
  datosDeGrupo: async () => 0,
  marcarEliminado: async (waId) => { marcados.push(waId); return 1; },
  conversacionDe: async (d) => ({ id: 1, ...d }),
  guardarMensaje: async (d) => ({ id: 1, ...d }),
  mensajePorWaId: async () => null,
  porId: async () => ({ id: 1, instancia: 'crm-u1' }),
}));

let servicio;
beforeEach(async () => {
  marcados.length = 0;
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

const aviso = (data) => ({ event: 'messages.delete', instance: 'crm-u1', data });

describe('borrar «para mi», que es la forma que se caia', () => {
  it('la clave dentro de `keys`, que es como la emite Baileys', async () => {
    const r = await servicio.recibir(aviso({
      keys: [{ remoteJid: '34600111222@s.whatsapp.net', id: 'WA-1', fromMe: true }],
    }));
    expect(marcados, 'el aviso entraba y no marcaba nada').toEqual(['WA-1']);
    expect(r.marcados).toBe(1);
  });

  it('varias de golpe', async () => {
    await servicio.recibir(aviso({
      keys: [
        { remoteJid: '34600111222@s.whatsapp.net', id: 'WA-1' },
        { remoteJid: '34600111222@s.whatsapp.net', id: 'WA-2' },
      ],
    }));
    expect(marcados).toEqual(['WA-1', 'WA-2']);
  });
});

describe('las formas que ya se atendian siguen valiendo', () => {
  it('la clave aplanada, como manda Evolution desde `messages.update`', async () => {
    await servicio.recibir(aviso({ id: 'WA-3', remoteJid: '34600111222@s.whatsapp.net', fromMe: false }));
    expect(marcados).toEqual(['WA-3']);
  });

  it('dentro de `key`', async () => {
    await servicio.recibir(aviso({ key: { id: 'WA-4', remoteJid: '34600111222@s.whatsapp.net' } }));
    expect(marcados).toEqual(['WA-4']);
  });

  it('una lista de claves sueltas', async () => {
    await servicio.recibir(aviso([{ keyId: 'WA-5' }, { keyId: 'WA-6' }]));
    expect(marcados).toEqual(['WA-5', 'WA-6']);
  });
});

describe('lo que no se toca', () => {
  it('un aviso sin clave no marca nada y no revienta', async () => {
    const r = await servicio.recibir(aviso({ keys: [] }));
    expect(marcados).toEqual([]);
    expect(r.marcados).toBe(0);
  });

  it('un aviso vacio tampoco', async () => {
    await servicio.recibir(aviso({}));
    expect(marcados).toEqual([]);
  });
});
