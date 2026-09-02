import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Al RECIBIR una respuesta hay que saber a que responde (#62).
 *
 * Mandar una cita ya funcionaba —se arreglo cuando Evolution rechazaba la
 * nuestra por mandarla como texto en vez de como objeto—, pero la otra mitad
 * no: cuando alguien responde desde su movil, el CRM tiene que apuntar a que
 * mensaje responde para poder pintar la cita encima.
 *
 * Y ahi estaba el mismo patron del #63. El puente de Baileys sacaba la cita del
 * `contextInfo` y la mandaba ya masticada como `respondeA`. Evolution manda el
 * mensaje crudo. Leyendo solo `respondeA`, en local se veia perfecto y en
 * produccion la cita no salia NUNCA.
 *
 * WhatsApp mete el contexto dentro del TIPO concreto: un texto citando lo lleva
 * en `extendedTextMessage`, una foto en `imageMessage`. Hay que mirarlos todos,
 * que es lo facil de olvidar y deja fuera las respuestas con foto o con audio.
 */

const guardados = [];

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  usuarioDeInstancia: (i) => { const m = /-u(\d+)$/.exec(String(i || '')); return m ? Number(m[1]) : null; },
  instanciaDe: (id) => `crm-u${id}`,
  PREFIJO: 'crm',
  descargarMedia: async () => null,
}));

vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  conversacionDe: async (d) => ({ id: 1, ...d }),
  guardarMensaje: async (d) => { guardados.push(d); return { id: 10, ...d }; },
  mensajePorWaId: async () => null,
  marcarEstado: async () => null,
  salientesRecientes: async () => 0,
  porId: async () => ({ id: 1, instancia: 'crm-u1' }),
}));

let servicio;
beforeEach(async () => {
  guardados.length = 0;
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

/** Un aviso tal cual lo manda Evolution: sin `respondeA`, con el crudo. */
const deEvolution = (message) => ({
  instance: 'crm-u1',
  data: {
    key: { remoteJid: '34600111222@s.whatsapp.net', id: 'WA-NUEVO', fromMe: false },
    pushName: 'Adrian Bravo',
    message,
    messageTimestamp: Math.floor(Date.now() / 1000),
  },
});

const citando = (id) => ({ stanzaId: id, participant: '34600111222@s.whatsapp.net' });

describe('la cita se saca del mensaje crudo', () => {
  it('un texto que responde a otro', async () => {
    await servicio.recibir(deEvolution({
      extendedTextMessage: { text: 'si, me viene bien', contextInfo: citando('WA-VIEJO') },
    }));
    expect(guardados[0]?.respondeA).toBe('WA-VIEJO');
  });

  it('una FOTO que responde a otro — el contexto no vive solo en el texto', async () => {
    await servicio.recibir(deEvolution({
      imageMessage: { mimetype: 'image/jpeg', caption: 'esta', contextInfo: citando('WA-FOTO') },
    }));
    expect(guardados[0]?.respondeA).toBe('WA-FOTO');
  });

  it('un audio tambien', async () => {
    await servicio.recibir(deEvolution({
      audioMessage: { mimetype: 'audio/ogg', contextInfo: citando('WA-AUDIO') },
    }));
    expect(guardados[0]?.respondeA).toBe('WA-AUDIO');
  });

  it('un mensaje que no responde a nada se queda sin cita', async () => {
    await servicio.recibir(deEvolution({ conversation: 'hola' }));
    expect(guardados[0]?.respondeA).toBeNull();
  });

  it('un contexto SIN stanzaId no inventa una cita', async () => {
    // WhatsApp mete `contextInfo` en mensajes que no citan a nadie —para las
    // menciones, por ejemplo—. Sin mirar el stanzaId, todos saldrian citando.
    await servicio.recibir(deEvolution({
      extendedTextMessage: { text: 'hola @todos', contextInfo: { mentionedJid: ['x@s.whatsapp.net'] } },
    }));
    expect(guardados[0]?.respondeA).toBeNull();
  });
});

describe('lo que ya mandaba el puente sigue valiendo', () => {
  it('si viene `respondeA` masticado, manda ese', async () => {
    const aviso = deEvolution({ conversation: 'vale' });
    aviso.data.respondeA = 'WA-DEL-PUENTE';
    await servicio.recibir(aviso);
    expect(guardados[0]?.respondeA).toBe('WA-DEL-PUENTE');
  });
});
