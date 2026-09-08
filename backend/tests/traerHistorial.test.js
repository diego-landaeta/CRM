import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Traer el historial de UN chat, a peticion (#73).
 *
 * «No aparecen los numeros de los seguimientos de tiempo atras, y una vez se
 * envia el mensaje aparece el chat». Esa ultima frase es la pista: el chat no
 * esta en la base hasta que pasa un mensaje por el CRM, y el buscador solo mira
 * lo guardado.
 *
 * La causa es `syncFullHistory: false` al enlazar. Ponerlo a `true` traeria
 * cientos de miles de mensajes de golpe en un numero con años de uso, asi que
 * se hace al reves: se pide UN chat cuando alguien lo busca y no aparece.
 *
 * Lo que se fija aqui es lo que hace que esto no se pudra:
 *
 *  · Reinyecta por el MISMO camino que el webhook. Una via paralela se
 *    quedaria atras al primer cambio de tipos, adjuntos o citas.
 *  · Va marcado como historial, para que sus adjuntos no se pongan por delante
 *    de los de ahora en la cola de descargas.
 *  · Sin sesion configurada no se inventa nada.
 */

const mensajesDe = vi.fn();

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  mensajesDe: (...a) => mensajesDe(...a),
  usuarioDeInstancia: (i) => { const m = /-u(\d+)$/.exec(String(i || '')); return m ? Number(m[1]) : null; },
  instanciaDe: (id) => `crm-u${id}`,
  PREFIJO: 'crm',
  descargarMedia: async () => null,
  fotoDe: async () => null,
  grupoDe: async () => null,
}));

const guardados = [];
vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  actualizarAvatar: async () => 0,
  datosDeGrupo: async () => 0,
  marcarEliminado: async () => 0,
  conversacionDe: async (d) => ({ id: 1, ...d }),
  guardarMensaje: async (d) => { guardados.push(d); return { id: guardados.length, ...d }; },
  mensajePorWaId: async () => null,
  marcarEstado: async () => null,
  salientesRecientes: async () => 0,
  porId: async () => ({ id: 1, instancia: 'crm-u1' }),
}));

let servicio;
beforeEach(async () => {
  guardados.length = 0;
  mensajesDe.mockReset();
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

const conversacion = {
  id: 1, jid: '34600111222@s.whatsapp.net', telefono: '34600111222', instancia: 'crm-u1',
};

const mensajeViejo = (id, texto) => ({
  key: { remoteJid: conversacion.jid, id, fromMe: false },
  message: { conversation: texto },
  messageTimestamp: 1750000000,
  pushName: 'Adrian Bravo',
});

describe('traer el historial de un chat', () => {
  it('le pide a Evolution ESE chat, no la cuenta entera', async () => {
    mensajesDe.mockResolvedValue([]);
    await servicio.traerHistorial({ conversacion, limite: 120 });
    expect(mensajesDe).toHaveBeenCalledWith(conversacion.jid, 'crm-u1', 120);
  });

  it('mete lo que trae', async () => {
    mensajesDe.mockResolvedValue([mensajeViejo('V1', 'hola de hace meses'), mensajeViejo('V2', 'y esto')]);
    const r = await servicio.traerHistorial({ conversacion });
    expect(r).toEqual({ pedidos: 2, metidos: 2 });
    expect(guardados.map((g) => g.texto)).toEqual(['hola de hace meses', 'y esto']);
  });

  it('sin historial no hace nada, y no es un fallo', async () => {
    mensajesDe.mockResolvedValue([]);
    expect(await servicio.traerHistorial({ conversacion })).toEqual({ pedidos: 0, metidos: 0 });
    expect(guardados).toHaveLength(0);
  });

  it('pasa por el mismo camino que el webhook: los tipos se resuelven igual', async () => {
    // Si esto se guardara por una via paralela, una foto del historial entraria
    // como «otro» y sin adjunto — que es lo que pasaba antes de que el webhook
    // aprendiera a abrir los sobres.
    mensajesDe.mockResolvedValue([{
      key: { remoteJid: conversacion.jid, id: 'V3', fromMe: false },
      message: { imageMessage: { mimetype: 'image/jpeg', caption: 'la foto del aula' } },
      messageTimestamp: 1750000001,
    }]);
    await servicio.traerHistorial({ conversacion });
    expect(guardados[0]?.tipo).toBe('imagen');
    expect(guardados[0]?.texto).toBe('la foto del aula');
  });

  it('una respuesta del historial conserva a que respondia', async () => {
    mensajesDe.mockResolvedValue([{
      key: { remoteJid: conversacion.jid, id: 'V4', fromMe: false },
      message: {
        extendedTextMessage: { text: 'si', contextInfo: { stanzaId: 'V1' } },
      },
      messageTimestamp: 1750000002,
    }]);
    await servicio.traerHistorial({ conversacion });
    expect(guardados[0]?.respondeA).toBe('V1');
  });
});

describe('cuando no se puede', () => {
  it('sin Evolution configurado, lo dice en vez de inventarse un cero', async () => {
    vi.resetModules();
    vi.doMock('../src/modules/whatsapp/evolution.client.js', () => ({
      configurado: () => false,
      mensajesDe: async () => [],
      usuarioDeInstancia: () => null,
      instanciaDe: (id) => `crm-u${id}`,
      PREFIJO: 'crm',
      descargarMedia: async () => null,
    }));
    const otro = await import('../src/modules/whatsapp/chat.service.js');
    await expect(otro.traerHistorial({ conversacion })).rejects.toMatchObject({ code: 'SIN_EVOLUTION' });
  });
});
