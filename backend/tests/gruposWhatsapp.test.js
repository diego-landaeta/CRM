import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Los grupos TIENEN que funcionar (#74): verse en la lista y poder escribir en
 * ellos. Aqui se fija lo segundo, que es lo que estaba roto sin que se notara —
 * el mensaje salia hacia un jid que no existe y nadie lo veia fallar.
 */

const enviarTexto = vi.fn(async () => ({ ok: true, waId: 'WA1' }));
const enviarMedia = vi.fn(async () => ({ ok: true, waId: 'WA2' }));
const presencia = vi.fn(async () => ({ ok: true }));
const editarTexto = vi.fn(async () => ({ ok: true }));

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  enviarTexto: (...a) => enviarTexto(...a),
  enviarMedia: (...a) => enviarMedia(...a),
  presencia: (...a) => presencia(...a),
  editarTexto: (...a) => editarTexto(...a),
  puedeEditar: () => true,
}));

const conversacion = { id: 7, jid: '120363412958104027@g.us', telefono: '120363412958104027', instancia: 'crm-u1', no_escribir: false };

vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  porId: async () => conversacion,
  // Ya se ha hablado antes: asi no salta el aviso de «numero desconocido».
  mensajes: async () => [{ id: 1 }],
  salientesRecientes: async () => 0,
  guardarMensaje: async (d) => ({ id: 1, ...d }),
  mensajePorWaId: async () => null,
  mensajePorId: async () => ({
    id: 5, conversacion_id: 7, wa_id: 'WA1', direccion: 'saliente',
    tipo: 'texto', texto: 'hola', ts: new Date(),
  }),
  corregirTexto: async (id, t) => ({ id, texto: t }),
}));

let servicio;
beforeEach(async () => {
  vi.clearAllMocks();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});
afterEach(() => vi.resetModules());

describe('escribir en un grupo (#74)', () => {
  it('manda el jid ENTERO, no las cifras sueltas', async () => {
    await servicio.enviar({ conversacionId: 7, texto: 'hola grupo', usuarioId: 1 })
      .catch(() => {});
    expect(enviarTexto).toHaveBeenCalled();
    const destino = enviarTexto.mock.calls[0][0];
    // Con `120363412958104027` a secas, al otro lado se reconstruye como
    // `...@s.whatsapp.net` y el mensaje no llega al grupo.
    expect(destino).toBe('120363412958104027@g.us');
  });

  it('el «escribiendo…» tambien va al grupo bueno', async () => {
    await servicio.enviar({ conversacionId: 7, texto: 'hola', usuarioId: 1 }).catch(() => {});
    expect(presencia.mock.calls[0][0]).toBe('120363412958104027@g.us');
  });

  it('corregir en un grupo apunta al grupo, no a un telefono inventado', async () => {
    await servicio.editarMensaje({
      mensajeId: 5, conversacion, texto: 'corregido', instancia: 'crm-u1',
    }).catch(() => {});
    expect(editarTexto).toHaveBeenCalled();
    expect(editarTexto.mock.calls[0][0]).toBe('120363412958104027@g.us');
  });
});

describe('a una persona no le cambia nada', () => {
  it('sigue yendo el numero pelado', async () => {
    conversacion.jid = '34612345678@s.whatsapp.net';
    conversacion.telefono = '34612345678';
    await servicio.enviar({ conversacionId: 7, texto: 'hola', usuarioId: 1 }).catch(() => {});
    expect(enviarTexto.mock.calls[0][0]).toBe('34612345678');
    conversacion.jid = '120363412958104027@g.us';
    conversacion.telefono = '120363412958104027';
  });

  it('un @lid va entero: sus cifras NO son un telefono', async () => {
    // Tomarlas por telefono es mandarle la conversacion a quien tenga esa linea.
    conversacion.jid = '188889999000111@lid';
    await servicio.enviar({ conversacionId: 7, texto: 'hola', usuarioId: 1 }).catch(() => {});
    expect(enviarTexto.mock.calls[0][0]).toBe('188889999000111@lid');
    conversacion.jid = '120363412958104027@g.us';
  });
});
