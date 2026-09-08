import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * En un grupo hay que saber quien dijo que, y como se llama el grupo (#99).
 *
 * Dos fallos distintos con la misma raiz: `pushName`. En un grupo NO es el
 * nombre del grupo, es el de quien acaba de escribir.
 *
 *  1. Usarlo para nombrar la conversacion hacia que «Psiko Aprende General»
 *     saliera como «199247962062849» y fuera cambiando segun quien hablara.
 *  2. El autor de cada mensaje se leia solo de `datos.participante`, que manda
 *     el puente de Baileys. Produccion habla con Evolution, que lo pone en
 *     `key.participant`. Resultado: el autor quedaba SIEMPRE vacio donde
 *     importa, mientras en local se veia bien. Es el patron del #63.
 *
 * A una persona suelta no le cambia nada, y eso tambien se fija aqui.
 */

const guardadas = [];
const mensajesGuardados = [];

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  usuarioDeInstancia: (i) => { const m = /-u(\d+)$/.exec(String(i || '')); return m ? Number(m[1]) : null; },
  instanciaDe: (id) => `crm-u${id}`,
  PREFIJO: 'crm',
  descargarMedia: async () => null,
  fotoDe: async () => null,
  grupoDe: async () => null,
}));

vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  actualizarAvatar: async () => 0,
  datosDeGrupo: async () => 0,
  marcarEliminado: async () => 0,
  conversacionDe: async (d) => { guardadas.push(d); return { id: 1, ...d }; },
  guardarMensaje: async (d) => { mensajesGuardados.push(d); return { id: 10, ...d }; },
  mensajePorWaId: async () => null,
  marcarEstado: async () => null,
  salientesRecientes: async () => 0,
  porId: async () => ({ id: 1, instancia: 'crm-u1' }),
}));

let servicio;
beforeEach(async () => {
  guardadas.length = 0;
  mensajesGuardados.length = 0;
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

/** Un aviso de Evolution: sin `datos.participante`, con `key.participant`. */
const avisoDeEvolution = (extra = {}) => ({
  instance: 'crm-u1',
  data: {
    key: {
      remoteJid: '120363412958104027@g.us',
      id: 'WA-1',
      fromMe: false,
      participant: '34600111222@s.whatsapp.net',
    },
    pushName: 'Marta Ruiz',
    message: { conversation: 'buenas a todos' },
    messageTimestamp: Math.floor(Date.now() / 1000),
    ...extra,
  },
});

describe('quien escribe en un grupo (#99, punto 2)', () => {
  it('lee el autor de `key.participant`, que es lo que manda Evolution', async () => {
    await servicio.recibir(avisoDeEvolution());
    expect(mensajesGuardados[0]?.participante).toBe('34600111222@s.whatsapp.net');
  });

  it('el nombre del autor sale de pushName, que en un grupo es quien habla', async () => {
    await servicio.recibir(avisoDeEvolution());
    expect(mensajesGuardados[0]?.participanteNombre).toBe('Marta Ruiz');
  });

  it('si viene por el puente, `datos.participante` sigue mandando', async () => {
    await servicio.recibir(avisoDeEvolution({ participante: '34699888777@s.whatsapp.net' }));
    expect(mensajesGuardados[0]?.participante).toBe('34699888777@s.whatsapp.net');
  });
});

describe('como se llama el grupo (#99, punto 2)', () => {
  it('NO se llama como quien escribio el ultimo mensaje', async () => {
    await servicio.recibir(avisoDeEvolution());
    expect(guardadas[0]?.nombrePush).not.toBe('Marta Ruiz');
  });

  it('se llama por su asunto cuando viene', async () => {
    await servicio.recibir(avisoDeEvolution({ groupSubject: 'Psiko Aprende General' }));
    expect(guardadas[0]?.nombrePush).toBe('Psiko Aprende General');
  });

  it('sin asunto se queda sin nombre, y no con uno que baila', async () => {
    await servicio.recibir(avisoDeEvolution());
    expect(guardadas[0]?.nombrePush).toBeNull();
  });
});

describe('a una persona suelta no le cambia nada', () => {
  const dePersona = {
    instance: 'crm-u1',
    data: {
      key: { remoteJid: '34600111222@s.whatsapp.net', id: 'WA-2', fromMe: false },
      pushName: 'Adrian Bravo',
      message: { conversation: 'hola' },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };

  it('sigue llamandose por su pushName', async () => {
    await servicio.recibir(dePersona);
    expect(guardadas[0]?.nombrePush).toBe('Adrian Bravo');
  });

  it('y no se le inventa un autor: fuera de un grupo no hay participante', async () => {
    await servicio.recibir(dePersona);
    expect(mensajesGuardados[0]?.participante).toBeNull();
    expect(mensajesGuardados[0]?.participanteNombre).toBeNull();
  });
});
