import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Reenviar un mensaje a otro chat (#99, punto 5).
 *
 * «De las cosas que mas se usan al pasar un dossier o un dato de una
 * conversacion a otra». Hasta ahora habia que descargar el archivo y volver a
 * subirlo a mano.
 *
 * Lo que se fija aqui:
 *
 *  - Un texto se manda como texto.
 *  - Un adjunto se lee del disco y se manda como adjunto, con su pie. NO se
 *    manda el texto por un lado y el archivo por otro: en WhatsApp el texto de
 *    una imagen es su pie, y separarlos parte en dos lo que era un mensaje.
 *  - Si el archivo aun no se ha bajado —la cola va por detras— se dice, en vez
 *    de mandar un mensaje a medias.
 *  - Una llamada no se reenvia.
 */

const enviarTexto = vi.fn(async () => ({ ok: true, waId: 'WA-NUEVO' }));
const enviarMedia = vi.fn(async () => ({ ok: true, waId: 'WA-NUEVO' }));
const leerMedia = vi.fn(async () => ({ buffer: Buffer.from('pdf'), size: 3 }));

vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  configurado: () => true,
  enviarTexto: (...a) => enviarTexto(...a),
  enviarMedia: (...a) => enviarMedia(...a),
  presencia: vi.fn(async () => ({ ok: true })),
  puedeEditar: () => true,
}));

vi.mock('../src/modules/whatsapp/media.service.js', async (original) => ({
  ...(await original()),
  leer: (...a) => leerMedia(...a),
}));

const destino = {
  id: 22, jid: '34600999888@s.whatsapp.net', telefono: '34600999888',
  instancia: 'crm-u1', no_escribir: false,
};

vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  porId: async () => destino,
  mensajes: async () => [{ id: 1 }],
  salientesRecientes: async () => 0,
  guardarMensaje: async (d) => ({ id: 99, ...d }),
  mensajePorWaId: async () => null,
}));

let servicio;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  servicio = await import('../src/modules/whatsapp/chat.service.js');
});

const texto = {
  id: 5, conversacion_id: 7, tipo: 'texto', texto: 'El master empieza en octubre',
  media_url: null, media_mime: null, nombre_archivo: null,
};
const conArchivo = {
  id: 6, conversacion_id: 7, tipo: 'documento', texto: 'Te paso el dossier',
  media_url: 'wa/2026/09/dossier.pdf', media_mime: 'application/pdf',
  nombre_archivo: 'dossier.pdf',
};

describe('reenviar un texto', () => {
  it('lo manda al chat de destino, no al de origen', async () => {
    await servicio.reenviar({ mensaje: texto, destinoId: destino.id, usuarioId: 1 });
    expect(enviarTexto).toHaveBeenCalledTimes(1);
    const [numero, cuerpo] = enviarTexto.mock.calls[0];
    expect(numero).toBe(destino.telefono);
    expect(cuerpo).toBe('El master empieza en octubre');
  });

  it('un texto vacio no se manda', async () => {
    await expect(
      servicio.reenviar({ mensaje: { ...texto, texto: '   ' }, destinoId: destino.id, usuarioId: 1 })
    ).rejects.toMatchObject({ code: 'VACIO' });
    expect(enviarTexto).not.toHaveBeenCalled();
  });
});

describe('reenviar un adjunto', () => {
  it('lee el archivo guardado y lo manda como adjunto', async () => {
    await servicio.reenviar({ mensaje: conArchivo, destinoId: destino.id, usuarioId: 1 });
    expect(leerMedia).toHaveBeenCalledWith('wa/2026/09/dossier.pdf');
    expect(enviarMedia).toHaveBeenCalledTimes(1);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('el texto viaja como pie, no como un mensaje aparte', async () => {
    await servicio.reenviar({ mensaje: conArchivo, destinoId: destino.id, usuarioId: 1 });
    const [, adjunto] = enviarMedia.mock.calls[0];
    expect(adjunto.pie).toBe('Te paso el dossier');
    expect(adjunto.nombreArchivo).toBe('dossier.pdf');
  });

  it('si el archivo aun no esta bajado, lo dice y no manda nada', async () => {
    leerMedia.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(
      servicio.reenviar({ mensaje: conArchivo, destinoId: destino.id, usuarioId: 1 })
    ).rejects.toMatchObject({ code: 'SIN_ARCHIVO' });
    expect(enviarMedia).not.toHaveBeenCalled();
    expect(enviarTexto).not.toHaveBeenCalled();
  });
});

describe('lo que no se reenvia', () => {
  it('una llamada no es un mensaje', async () => {
    await expect(
      servicio.reenviar({
        mensaje: { id: 8, conversacion_id: 7, tipo: 'llamada', texto: 'perdida', media_url: null },
        destinoId: destino.id, usuarioId: 1,
      })
    ).rejects.toMatchObject({ code: 'NO_REENVIABLE' });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(enviarMedia).not.toHaveBeenCalled();
  });
});
