import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// El freno que faltaba en la #63.
//
// Alli el CRM le pedia a Evolution dos direcciones que no existen en la version
// que corre y las pedia EN BUCLE: 136 errores en diez minutos, tapando los
// errores de verdad. Lo que fallo no fue intentarlo — fue seguir intentandolo.
//
// Este fichero va SIN mocks del cliente a proposito: lo que se prueba es el
// cliente de verdad, con la red interceptada.

const fetchOriginal = globalThis.fetch;
let veces = 0;
let respuesta = { ok: false, status: 404 };

beforeAll(() => {
  process.env.EVOLUTION_URL = 'http://localhost:1';
  process.env.EVOLUTION_API_KEY = 'clave-de-prueba';
  globalThis.fetch = async () => {
    veces += 1;
    return { ok: respuesta.ok, status: respuesta.status, text: async () => '{}' };
  };
});
afterAll(() => { globalThis.fetch = fetchOriginal; });

describe('cuando esta Evolution no sabe editar', () => {
  it('se entera UNA vez y no vuelve a preguntar en toda la vida del proceso', async () => {
    const ev = await import('../src/modules/whatsapp/evolution.client.js');
    ev._reiniciarEdicion();
    veces = 0;

    expect(ev.puedeEditar()).toBe(true);

    const uno = await ev.editarTexto('34600111222', { waId: 'a', jid: 'b' }, 'x', 'crm-u1');
    expect(uno.error).toBe('NO_SOPORTADO');
    // Y se apaga: la pantalla dejara de ofrecer el boton.
    expect(ev.puedeEditar()).toBe(false);

    // La segunda ni sale a la red. Aqui esta la diferencia con la #63.
    const dos = await ev.editarTexto('34600111222', { waId: 'a', jid: 'b' }, 'x', 'crm-u1');
    expect(dos.error).toBe('NO_SOPORTADO');
    expect(veces).toBe(1);

    const tres = await ev.editarTexto('34600111222', { waId: 'a', jid: 'b' }, 'x', 'crm-u1');
    expect(tres.error).toBe('NO_SOPORTADO');
    expect(veces).toBe(1);
  });

  it('pero un fallo pasajero NO la apaga: eso si hay que reintentarlo', async () => {
    // Un 500 o un corte de red es otra cosa. Apagar la funcion por un parpadeo
    // dejaria a la gestora sin poder corregir hasta el siguiente reinicio.
    const ev = await import('../src/modules/whatsapp/evolution.client.js');
    ev._reiniciarEdicion();
    respuesta = { ok: false, status: 500 };
    veces = 0;

    await ev.editarTexto('34600111222', { waId: 'a', jid: 'b' }, 'x', 'crm-u1');
    expect(ev.puedeEditar()).toBe(true);
    await ev.editarTexto('34600111222', { waId: 'a', jid: 'b' }, 'x', 'crm-u1');
    expect(veces).toBe(2);

    respuesta = { ok: false, status: 404 };
  });
});
