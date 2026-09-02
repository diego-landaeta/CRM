import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * El aviso de una llamada entrante llega de dos formas (#63, #67).
 *
 * Baileys emite `call` con un ARRAY —`sock.ev.on('call', (llamadas) => …)`—
 * porque WhatsApp puede notificar varias de golpe. Quien lo reenvie fielmente
 * manda ese array.
 *
 * El CRM leia `datos.id` a secas. Con una lista eso es undefined y la llamada se
 * descartaba entera por «sin id», sin dejar rastro: en produccion no se
 * registraria ni una sola llamada entrante y nadie sabria por que.
 *
 * Es el mismo patron del #63 —suponer la forma que manda el puente— pero peor,
 * porque el puente NI SIQUIERA maneja llamadas: esto no se podia probar en
 * local de ninguna manera. Por eso se aceptan las dos formas en vez de elegir
 * una: aceptar de mas no rompe nada, suponer si.
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
  conversacionDe: async (d) => ({ id: 1, telefono: '34600111222', nombre_push: 'Adrian', ...d }),
  guardarMensaje: async (d) => { guardados.push(d); return { id: 1, ...d }; },
  mensajePorWaId: async () => null,
  porId: async () => ({ id: 1, instancia: 'crm-u1' }),
}));

let servicio;
beforeEach(async () => {
  guardados.length = 0;
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

const laLlamada = (estado) => ({
  id: 'CALL-1',
  from: '34600111222@s.whatsapp.net',
  status: estado,
  isVideo: false,
  isGroup: false,
  date: new Date().toISOString(),
});

describe('una llamada entrante se registra venga como venga', () => {
  it('como objeto', async () => {
    await servicio.recibir({ event: 'call', instance: 'crm-u1', data: laLlamada('timeout') });
    expect(guardados[0]?.tipo).toBe('llamada');
    expect(guardados[0]?.texto).toBe('perdida');
  });

  it('como LISTA, que es como la emite Baileys', async () => {
    await servicio.recibir({ event: 'call', instance: 'crm-u1', data: [laLlamada('timeout')] });
    expect(guardados[0]?.tipo, 'con una lista se descartaba por «sin id»').toBe('llamada');
    expect(guardados[0]?.texto).toBe('perdida');
  });

  it('una rechazada tambien, y en lista', async () => {
    await servicio.recibir({ event: 'call', instance: 'crm-u1', data: [laLlamada('reject')] });
    expect(guardados[0]?.texto).toBe('rechazada');
  });

  it('una contestada tambien', async () => {
    await servicio.recibir({ event: 'call', instance: 'crm-u1', data: [laLlamada('accept')] });
    expect(guardados[0]?.texto).toBe('contestada');
  });
});

describe('lo que sigue sin guardarse, y esta bien', () => {
  it('mientras solo suena no hay desenlace que apuntar', async () => {
    await servicio.recibir({ event: 'call', instance: 'crm-u1', data: [laLlamada('offer')] });
    expect(guardados).toHaveLength(0);
  });

  it('una lista vacia no revienta', async () => {
    const r = await servicio.recibir({ event: 'call', instance: 'crm-u1', data: [] });
    expect(r?.ignorado).toBeTruthy();
    expect(guardados).toHaveLength(0);
  });
});
