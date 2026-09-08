import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * El volcado de FORMA no puede filtrar contenido.
 *
 * Existe para responder a «que manda Evolution de verdad» sin desplegar a
 * ciegas: llevamos una semana arreglando el mismo fallo —un campo con la forma
 * del puente que en produccion no viene— y la causa de fondo era que nadie
 * habia mirado nunca el aviso crudo.
 *
 * Pero se enciende en PRODUCCION, sobre conversaciones de clientes. Si guardara
 * el texto de los mensajes o los telefonos, seria un problema mayor que el que
 * resuelve. Por eso guarda solo la estructura, y eso se fija aqui: lo que se
 * pueda leer tiene que poder pegarse en un issue sin pensarlo.
 */

let forma;

beforeEach(async () => {
  process.env.WHATSAPP_VOLCAR_FORMA = '1';
  forma = await import('../src/modules/whatsapp/avisos.forma.js');
  forma.olvidar();
});

afterEach(() => { delete process.env.WHATSAPP_VOLCAR_FORMA; });

const unMensaje = {
  event: 'messages.upsert',
  instance: 'crm-u6',
  data: {
    key: { remoteJid: '34722134659@s.whatsapp.net', id: 'ABC123', fromMe: false },
    pushName: 'Maria Gabriela',
    message: { conversation: 'Me interesa el diplomado, cuanto cuesta' },
    messageTimestamp: '1788000000',
  },
};

describe('lo que guarda', () => {
  it('dice que claves vienen', () => {
    forma.apuntar(unMensaje);
    const f = forma.loApuntado().eventos['messages.upsert'][0].forma;
    expect(Object.keys(f)).toEqual(['event', 'instance', 'data']);
    expect(Object.keys(f.data)).toContain('key');
    expect(Object.keys(f.data)).toContain('pushName');
  });

  it('dice si `data` viene como lista — que es lo que nos mordio con las llamadas', () => {
    forma.apuntar({ event: 'call', instance: 'crm-u6', data: [{ id: 'C1', status: 'timeout' }] });
    const a = forma.loApuntado().eventos.call[0];
    expect(a.dataEsLista).toBe(true);
    expect(a.forma.data._lista).toBe(1);
  });

  it('dice de que TIPO es cada valor, que es la otra pregunta', () => {
    // `status` como numero o como texto decide si el doble tic se pinta.
    forma.apuntar({ event: 'messages.update', instance: 'crm-u6', data: { status: 3 } });
    expect(forma.loApuntado().eventos['messages.update'][0].forma.data.status).toBe('numero');
  });
});

describe('lo que NO guarda, que es lo importante', () => {
  it('ni el texto de un mensaje', () => {
    forma.apuntar(unMensaje);
    const todo = JSON.stringify(forma.loApuntado());
    expect(todo).not.toContain('Me interesa el diplomado');
    expect(todo).not.toContain('diplomado');
  });

  it('ni el telefono', () => {
    forma.apuntar(unMensaje);
    expect(JSON.stringify(forma.loApuntado())).not.toContain('34722134659');
  });

  it('ni el nombre de nadie', () => {
    forma.apuntar(unMensaje);
    expect(JSON.stringify(forma.loApuntado())).not.toContain('Maria Gabriela');
  });

  it('ni el identificador del mensaje', () => {
    forma.apuntar(unMensaje);
    expect(JSON.stringify(forma.loApuntado())).not.toContain('ABC123');
  });

  it('de un texto solo dice cuanto mide', () => {
    forma.apuntar({ event: 'x', data: { texto: 'hola' } });
    expect(forma.loApuntado().eventos.x[0].forma.data.texto).toBe('texto(4)');
  });
});

describe('los limites', () => {
  it('apagado no apunta nada', () => {
    delete process.env.WHATSAPP_VOLCAR_FORMA;
    forma.apuntar(unMensaje);
    expect(forma.loApuntado().eventos).toEqual({});
  });

  it('guarda tres ejemplares por evento y no mas', () => {
    // Sin tope, un webhook con trafico llenaria la memoria del proceso.
    for (let i = 0; i < 10; i++) forma.apuntar(unMensaje);
    expect(forma.loApuntado().eventos['messages.upsert']).toHaveLength(3);
  });

  it('un aviso roto no lo tumba', () => {
    // Va dentro del webhook: un fallo aqui no puede impedir que entre un mensaje.
    const circular = { event: 'raro' };
    circular.yo = circular;
    expect(() => forma.apuntar(circular)).not.toThrow();
  });
});
