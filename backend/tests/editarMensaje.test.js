import { describe, it, expect, vi, beforeEach } from 'vitest';

// «Se siguen enviando y no permite corregir desde la app» — tarea #75.
//
// Hasta ahora, un error de dedo en un mensaje a un prospecto se quedaba ahi para
// siempre y la unica salida era mandar otro pidiendo perdon.
//
// Las tres condiciones no son nuestras, son de WhatsApp: solo lo que uno mismo
// mando, solo texto, y solo durante 15 minutos. Se comprueban ANTES de molestar
// a Evolution — preguntar sabiendo que va a decir que no es tirar una peticion.

let mensaje = null;
const editadas = [];
vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  mensajePorId: vi.fn(async () => mensaje),
  corregirTexto: vi.fn(async (id, texto) => ({ id, texto })),
}));

let respuestaEvolution = { ok: true };
const llamadas = [];
vi.mock('../src/modules/whatsapp/evolution.client.js', () => ({
  editarTexto: vi.fn(async (...a) => { llamadas.push(a); return respuestaEvolution; }),
  instanciaDe: () => 'crm-u1',
  configurado: () => true,
}));

const { editarMensaje, VENTANA_EDICION_MS } = await import('../src/modules/whatsapp/chat.service.js');

const CONV = { id: 7, jid: '34600111222@s.whatsapp.net', telefono: '34600111222' };
const base = (extra = {}) => ({
  id: 1, conversacion_id: 7, wa_id: 'WA-1', direccion: 'saliente',
  tipo: 'texto', texto: 'Hla', ts: new Date().toISOString(), ...extra,
});
const editar = (texto = 'Hola') =>
  editarMensaje({ mensajeId: 1, conversacion: CONV, texto, instancia: 'crm-u1' });

beforeEach(() => {
  mensaje = base();
  llamadas.length = 0; editadas.length = 0;
  respuestaEvolution = { ok: true };
});

describe('lo que WhatsApp deja corregir', () => {
  it('un texto propio y reciente, si', async () => {
    const r = await editar('Hola');
    expect(r).toMatchObject({ texto: 'Hola' });
    expect(llamadas).toHaveLength(1);
  });

  it('le pasa la clave del mensaje como OBJETO, no el identificador suelto', async () => {
    // Es el fallo de la cita en #62: Evolution hace `key.fromMe` por dentro y con
    // una cadena revienta con un 400 que no dice nada.
    await editar('Hola');
    const [numero, clave, texto] = llamadas[0];
    expect(numero).toBe('34600111222');
    expect(clave).toEqual({ waId: 'WA-1', jid: CONV.jid, mio: true });
    expect(texto).toBe('Hola');
  });
});

describe('lo que NO, y sin preguntarle a Evolution', () => {
  it('un mensaje que llego, no que se mando', async () => {
    mensaje = base({ direccion: 'entrante' });
    await expect(editar()).rejects.toThrow(/mensajes que has mandado/i);
    expect(llamadas).toHaveLength(0);
  });

  it('un adjunto: se corrige el texto, no un archivo', async () => {
    mensaje = base({ tipo: 'imagen' });
    await expect(editar()).rejects.toThrow(/no un archivo/i);
    expect(llamadas).toHaveLength(0);
  });

  it('pasados los 15 minutos', async () => {
    mensaje = base({ ts: new Date(Date.now() - VENTANA_EDICION_MS - 1000).toISOString() });
    await expect(editar()).rejects.toThrow(/15 minutos/);
    expect(llamadas).toHaveLength(0);
  });

  it('justo dentro del plazo, si', async () => {
    mensaje = base({ ts: new Date(Date.now() - VENTANA_EDICION_MS + 5000).toISOString() });
    await expect(editar()).resolves.toBeTruthy();
  });

  it('uno que nunca llego a salir', async () => {
    // Sin identificador de WhatsApp no hay a que apuntar. Son los que fallaron:
    // no existen al otro lado, asi que no hay nada que corregir.
    mensaje = base({ wa_id: null });
    await expect(editar()).rejects.toThrow(/no llego a salir/i);
    expect(llamadas).toHaveLength(0);
  });

  it('uno de la conversacion de otra persona', async () => {
    mensaje = base({ conversacion_id: 999 });
    await expect(editar()).rejects.toThrow(/no encontrado/i);
    expect(llamadas).toHaveLength(0);
  });
});

describe('si esta Evolution no sabe editar', () => {
  it('lo dice en cristiano, no con un codigo', async () => {
    respuestaEvolution = { ok: false, error: 'NO_SOPORTADO' };
    await expect(editar()).rejects.toThrow(/no permite corregir/i);
  });

  it('y un fallo cualquiera no se disfraza de exito', async () => {
    respuestaEvolution = { ok: false, error: 'HTTP_500' };
    await expect(editar()).rejects.toThrow(/no se pudo corregir/i);
  });
});
