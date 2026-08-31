import { describe, it, expect, vi, beforeEach } from 'vitest';

// «No llega ninguna notificación» — y no era que estuviera rota: no existia.
//
// Habia tres muros y cada uno bastaba por si solo:
//
//   1. El backend no creaba ningun aviso al llegar un WhatsApp. Ni una llamada
//      a notifyUsers desde el modulo entero.
//   2. `showLocal`, que dispara el aviso del navegador, solo la llamaba el
//      boton «probar» de la pagina de Notificaciones.
//   3. La suscripcion a push era un simulacro: escribia `endpoint: 'local-only'`
//      en localStorage, ponia «suscrita» y `/api/push-subscriptions` no existe.
//
// Esto es el cimiento del arreglo: la pregunta barata que se hace desde el
// layout cada pocos segundos.

const capturado = [];
let respuestas = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => {
    capturado.push({ sql, params });
    return { rows: respuestas.shift() ?? [] };
  }),
}));

const { sinLeer } = await import('../src/modules/whatsapp/chat.model.js');

beforeEach(() => { capturado.length = 0; respuestas = []; });

describe('sin nada que avisar', () => {
  it('no se molesta en buscar el ultimo mensaje', async () => {
    // Se pregunta cada diez segundos desde TODAS las pantallas del CRM. Con
    // cero sin leer, la segunda consulta es tiempo tirado.
    respuestas = [[{ total: 0, conversaciones: 0 }]];
    const r = await sinLeer('x');
    expect(r).toEqual({ total: 0, conversaciones: 0, ultimo: null });
    expect(capturado).toHaveLength(1);
  });
});

describe('cuando hay algo sin leer', () => {
  beforeEach(() => {
    respuestas = [
      [{ total: 3, conversaciones: 2 }],
      [{ id: 9, conversacion_id: 4, quien: 'Lucia', es_grupo: false, tipo: 'texto', texto: 'Hola', ts: '2026-08-26T10:00:00Z' }],
    ];
  });

  it('dice cuantos y de cuantas conversaciones', async () => {
    const r = await sinLeer('x');
    expect(r.total).toBe(3);
    expect(r.conversaciones).toBe(2);
  });

  it('y de quien es el ultimo, para poder decirlo sin abrir nada', async () => {
    const r = await sinLeer('x');
    expect(r.ultimo).toMatchObject({ id: 9, conversacionId: 4, quien: 'Lucia', esGrupo: false });
  });

  it('solo mira los ENTRANTES: lo que manda la gestora no se avisa a si misma', async () => {
    await sinLeer('x');
    expect(capturado[1].sql).toMatch(/m\.direccion = 'entrante'/);
  });

  it('y solo de la instancia que pregunta', async () => {
    // Sin esto, una gestora recibiria el aviso del mensaje de otra.
    await sinLeer('x');
    expect(capturado[0].params).toEqual(['x']);
    expect(capturado[1].params).toEqual(['x']);
  });
});

describe('lo que no puede pasar', () => {
  it('el texto se recorta: esto va a un aviso del sistema, no al chat', async () => {
    const larguisimo = 'a'.repeat(500);
    respuestas = [
      [{ total: 1, conversaciones: 1 }],
      [{ id: 1, conversacion_id: 1, quien: 'X', es_grupo: false, tipo: 'texto', texto: larguisimo, ts: '2026-08-26T10:00:00Z' }],
    ];
    const r = await sinLeer('x');
    expect(r.ultimo.texto.length).toBeLessThanOrEqual(140);
  });

  it('un adjunto sin pie no deja el aviso vacio: se manda el tipo', async () => {
    // La pantalla lo convierte en «Te ha mandado una foto». Si aqui no viniera
    // el tipo, el aviso saldria en blanco — el mismo fallo que el chat del bot.
    respuestas = [
      [{ total: 1, conversaciones: 1 }],
      [{ id: 1, conversacion_id: 1, quien: 'X', es_grupo: false, tipo: 'imagen', texto: null, ts: '2026-08-26T10:00:00Z' }],
    ];
    const r = await sinLeer('x');
    expect(r.ultimo.texto).toBeNull();
    expect(r.ultimo.tipo).toBe('imagen');
  });

  it('cuenta solo lo que ya venia marcado sin leer, no todo el historial', async () => {
    // `no_leidos` ya solo sube con lo que entra DE VERDAD ahora: el UPDATE de
    // guardarMensaje se salta lo de hace mas de dos minutos. Al emparejar un
    // numero entran miles de mensajes viejos, y sin ese freno esto dispararia
    // mil avisos de golpe. Comprobado ademas contra la base.
    respuestas = [[{ total: 0, conversaciones: 0 }]];
    await sinLeer('x');
    expect(capturado[0].sql).toMatch(/c\.no_leidos > 0/);
  });
});
