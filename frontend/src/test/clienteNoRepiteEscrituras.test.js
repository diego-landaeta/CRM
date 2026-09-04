import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * El cliente reintenta ante un 502, y eso SOLO vale para leer.
 *
 * El reintento se puso por los deploys: nginx se queda un segundo sin upstream
 * mientras PM2 reinicia y el usuario veia un error que se arreglaba solo. Para
 * un GET es correcto — pedir dos veces lo mismo no cambia nada.
 *
 * Para un POST no. Se vio mandando un WhatsApp: UN solo Enter dejaba TRES
 * mensajes. El servidor contesta 502 cuando WhatsApp rechaza el envio, el
 * cliente lo reintentaba dos veces mas, y como el backend apunta cada intento
 * fallido antes de contestar, quedaban tres filas. Comprobado contra la base.
 *
 * Y lo grave no es la fila de mas: un 502 no significa «no se hizo nada». Si
 * Evolution llego a entregar el mensaje y fallo despues, el reintento se lo
 * manda al prospecto OTRA VEZ. Tres veces el mismo mensaje, sin que nadie lo
 * haya pedido y sin poder deshacerlo.
 */

let client;
let fetchFalso;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchFalso = vi.fn();
  global.fetch = fetchFalso;
  client = (await import('@/shared/api/client')).default;
});

afterEach(() => { vi.useRealTimers(); });

/** Una respuesta como la que devuelve `fetch`. */
const respuesta = (status, cuerpo = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => cuerpo,
  headers: { get: () => 'application/json' },
});

/** Lanza la peticion y deja correr los tiempos de espera del reintento. */
async function conReintentos(promesa) {
  const p = promesa.catch(() => null);
  await vi.runAllTimersAsync();
  return p;
}

describe('un 502 leyendo se reintenta', () => {
  it('un GET se pide hasta tres veces', async () => {
    fetchFalso.mockResolvedValue(respuesta(502));
    await conReintentos(client.get('/lo-que-sea'));
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('y si a la segunda contesta, no hay tercera', async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta(502))
      .mockResolvedValueOnce(respuesta(200, { success: true, data: [] }));
    await conReintentos(client.get('/lo-que-sea'));
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});

describe('un 502 escribiendo NO se reintenta', () => {
  it('un POST se manda UNA vez y punto', async () => {
    fetchFalso.mockResolvedValue(respuesta(502));
    await conReintentos(client.post('/whatsapp/chats/1/enviar', { texto: 'hola' }));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('un PATCH tampoco', async () => {
    fetchFalso.mockResolvedValue(respuesta(502));
    await conReintentos(client.patch('/lo-que-sea', { a: 1 }));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('un DELETE tampoco', async () => {
    fetchFalso.mockResolvedValue(respuesta(502));
    await conReintentos(client.delete('/lo-que-sea'));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('ni cuando la red se cae del todo', async () => {
    // Un fallo de red tampoco dice que no se haya hecho nada: la peticion pudo
    // llegar y perderse la respuesta.
    fetchFalso.mockRejectedValue(new Error('network'));
    await conReintentos(client.post('/lo-que-sea', { a: 1 }));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
