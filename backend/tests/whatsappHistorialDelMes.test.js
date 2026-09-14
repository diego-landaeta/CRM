import { describe, it, expect, vi, beforeEach } from 'vitest';

// «El ultimo mes» tiene que traer el ultimo mes (#73).
//
// Reportado por el equipo: al enlazar eligiendo «el ultimo mes» no llegaba
// nada. Y no era el recorte —que estaba bien escrito y probado— sino que el
// historial NO PASABA POR AHI: Evolution no lo manda por `messages.upsert`.
//
// Al sincronizar, Baileys emite `messaging-history.set` y Evolution lo reenvia
// al webhook como `messages.set`, con un ARRAY en `data`. Comprobado en su
// codigo, etiqueta 2.3.7:
//
//   whatsapp.baileys.service.ts:1049
//     this.sendDataWebhook(Events.MESSAGES_SET, [...messagesRaw], ...)
//   wa.types.ts:12
//     MESSAGES_SET = 'messages.set'
//
// El CRM ni pedia ese evento ni lo atendia: `recibir()` lo descartaba con
// «ignorado» y `EVENTOS_QUE_ATENDEMOS` no lo nombraba, asi que Evolution ni
// siquiera se lo mandaba. Resultado: las tres opciones de la pantalla hacian lo
// mismo que «empezar de cero».
//
// En local parecia funcionar, y ese es el detalle que lo escondio: el puente de
// Baileys manda su historial como `messages.upsert`. Otra vez la #63.

const query = vi.fn(async () => ({ rows: [] }));
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));

const guardarMensaje = vi.fn(async () => ({ id: 1, ts: new Date() }));
const conversacionDe = vi.fn(async () => ({ id: 7, lead_id: null, avatar_url: null, nombre: 'Marta' }));
vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  guardarMensaje: (...a) => guardarMensaje(...a),
  conversacionDe: (...a) => conversacionDe(...a),
  actualizarAvatar: vi.fn(async () => {}),
  actualizarEstado: vi.fn(async () => {}),
  apuntarInteraccion: vi.fn(async () => {}),
  corregirTexto: vi.fn(async () => {}),
  datosDeGrupo: vi.fn(async () => null),
  hayConversaciones: vi.fn(async () => true),
  marcarEliminado: vi.fn(async () => 0),
  marcarLeida: vi.fn(async () => {}),
  mensajePorId: vi.fn(async () => null),
  mensajePorWaId: vi.fn(async () => null),
  mensajes: vi.fn(async () => []),
  porId: vi.fn(async () => null),
  salientesRecientes: vi.fn(async () => []),
  ultimoEntranteSinLeer: vi.fn(async () => null),
}));
vi.mock('../src/modules/whatsapp/evolution.client.js', async (orig) => {
  const real = await orig();
  // Devuelven promesa: el camino del mensaje encadena `.then` sobre la foto y
  // sobre los datos del grupo, y un `vi.fn()` pelado devuelve undefined.
  return {
    ...real,
    configurado: () => false,
    bajarMedia: vi.fn(async () => null),
    fotoDe: vi.fn(async () => null),
    grupoDe: vi.fn(async () => null),
  };
});

const servicio = await import('../src/modules/whatsapp/chat.service.js');
const politica = await import('../src/modules/whatsapp/politica.js');
const evolution = await import('../src/modules/whatsapp/evolution.client.js');

const HOY = Math.floor(Date.now() / 1000);
const HACE_40_DIAS = HOY - 40 * 24 * 3600;
const HACE_10_DIAS = HOY - 10 * 24 * 3600;

/** Un mensaje con la forma que Evolution deja en la tanda (`prepareMessage`). */
const mensaje = (id, ts) => ({
  key: { id, remoteJid: '34600111222@s.whatsapp.net', fromMe: false },
  pushName: 'Marta',
  message: { conversation: `mensaje ${id}` },
  messageTimestamp: ts,
});

const tanda = (mensajes, extra = {}) => ({
  event: 'messages.set',
  instance: 'crm-u4',
  data: mensajes,
  ...extra,
});

describe('el historial entra por messages.set, no por messages.upsert', () => {
  beforeEach(() => {
    guardarMensaje.mockClear();
    conversacionDe.mockClear();
    politica._olvidarModos();
  });

  it('el evento esta suscrito — sin esto Evolution ni lo manda', () => {
    // La causa raiz. `asegurarEventos()` lo repone tambien en las sesiones ya
    // creadas, que si no se quedarian sin historial para siempre.
    expect(evolution.EVENTOS_QUE_ATENDEMOS).toContain('MESSAGES_SET');
  });

  it('ya no se descarta como evento desconocido', async () => {
    const r = await servicio.recibir(tanda([mensaje('A', HOY)]));
    expect(r.ignorado).toBeUndefined();
    expect(r.historial).toBe(1);
  });

  it('guarda los mensajes de la tanda, uno a uno', async () => {
    await servicio.recibir(tanda([mensaje('A', HOY), mensaje('B', HACE_10_DIAS)]));
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(2);
  });

  it('con «el ultimo mes» apuntado, lo de hace 40 dias se queda fuera', async () => {
    // El recorte ya existia; lo que faltaba era que el historial pasara por el.
    politica.apuntarModo('crm-u4', 'rapido');
    await servicio.recibir(tanda([mensaje('A', HACE_10_DIAS), mensaje('B', HACE_40_DIAS)]));
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(1);
  });

  it('con «todo el historial», lo viejo tambien entra', async () => {
    politica.apuntarModo('crm-u4', 'todo');
    await servicio.recibir(tanda([mensaje('A', HACE_40_DIAS)]));
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(1);
  });

  it('contesta SIN esperar a guardar la tanda', async () => {
    // Evolution espera a que el webhook conteste antes de seguir con el
    // siguiente aviso. Con una tanda de miles de mensajes, guardar antes de
    // contestar le para la cola entera: paso una vez y el numero se quedo mudo
    // toda la manana. Se contesta y se guarda detras.
    const muchos = Array.from({ length: 50 }, (_, i) => mensaje(`m${i}`, HOY));
    const r = await servicio.recibir(tanda(muchos));
    expect(r.encolado).toBe(true);
    expect(guardarMensaje).not.toHaveBeenCalled();
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(50);
  });

  it('acepta las DOS formas: el array pelado de Evolution y el envuelto del puente', async () => {
    // Suponer una sola forma es lo que costo la #63 y la #99.
    await servicio.recibir(tanda([mensaje('A', HOY)]));
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(1);

    guardarMensaje.mockClear();
    await servicio.recibir({
      event: 'messages.set', instance: 'crm-u4', data: { messages: [mensaje('B', HOY)] },
    });
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(1);
  });

  it('una tanda vacia no rompe nada', async () => {
    expect(await servicio.recibir(tanda([]))).toEqual({ historial: 0 });
  });

  it('el progreso de la tanda alimenta la barra', async () => {
    // Evolution lo manda junto a la tanda; hasta ahora la barra solo se movia
    // en local, donde el puente lo emite en su propio evento.
    await servicio.recibir(tanda([mensaje('A', HOY)], { progress: 42, isLatest: false }));
    expect(servicio.progresoDe('crm-u4')).toBe(42);
  });

  it('un mensaje roto no se lleva por delante la tanda', async () => {
    guardarMensaje.mockRejectedValueOnce(new Error('columna rara'));
    await servicio.recibir(tanda([mensaje('A', HOY), mensaje('B', HOY)]));
    await servicio._historialGuardado();
    expect(guardarMensaje).toHaveBeenCalledTimes(2);
  });
});
