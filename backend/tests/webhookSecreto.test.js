import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * La puerta del webhook.
 *
 * Esta ruta va SIN `verifyToken` a proposito: quien llama es el contenedor de
 * Evolution, no un navegador con sesion. Lo unico que la protege es un secreto
 * compartido — y no habia ni una prueba que lo comprobara.
 *
 * Lo que hay detras: crear conversaciones, meter mensajes en el hilo de una
 * gestora y marcar como entregados los que no salieron. Cualquiera que supiera
 * la direccion podria escribir en la conversacion de un cliente. Es el mismo
 * agujero que ya tuvimos con el webhook de Stripe.
 *
 * Y el fallo no seria ruidoso: la ruta contesta 200 casi siempre a proposito
 * —si contestara error, Evolution reintentaria en bucle— asi que una puerta
 * abierta se ve exactamente igual que una cerrada.
 *
 * Se comprueban las dos formas de mandarlo, porque las dos hacen falta: la
 * cabecera es lo natural, pero el webhook GLOBAL de Evolution solo deja
 * configurar una direccion, sin cabeceras propias.
 */

const recibir = vi.fn(async () => ({ ok: true }));
vi.mock('../src/modules/whatsapp/chat.service.js', () => ({
  recibir: (...a) => recibir(...a),
}));
vi.mock('../src/shared/config/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));

const ctrl = await import('../src/modules/whatsapp/chat.controller.js');

/** Un `res` de mentira que apunta lo que le mandan. */
function fingirRes() {
  const res = { codigo: 200, cuerpo: null };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.setHeader = () => res;
  return res;
}

/** Una llamada al webhook, con lo justo que mira el guardia. */
const llamar = async ({ cabecera = null, query = {} } = {}) => {
  const req = {
    body: { event: 'messages.upsert', instance: 'crm-u1', data: {} },
    query,
    ip: '127.0.0.1',
    get: (n) => (String(n).toLowerCase() === 'x-webhook-secret' ? cabecera : null),
  };
  const res = fingirRes();
  await ctrl.webhook(req, res);
  return res;
};

const ANTES = process.env.EVOLUTION_WEBHOOK_SECRET;
const ANTES_ENTORNO = process.env.NODE_ENV;

beforeEach(() => { recibir.mockClear(); });
afterEach(() => {
  if (ANTES === undefined) delete process.env.EVOLUTION_WEBHOOK_SECRET;
  else process.env.EVOLUTION_WEBHOOK_SECRET = ANTES;
  process.env.NODE_ENV = ANTES_ENTORNO;
});

describe('con el secreto puesto', () => {
  beforeEach(() => { process.env.EVOLUTION_WEBHOOK_SECRET = 'el-secreto'; });

  it('sin secreto ninguno, 401 y no se procesa nada', async () => {
    const res = await llamar();
    expect(res.codigo).toBe(401);
    expect(recibir, 'un aviso sin secreto llego al servicio').not.toHaveBeenCalled();
  });

  it('con el secreto equivocado, 401', async () => {
    const res = await llamar({ cabecera: 'otro' });
    expect(res.codigo).toBe(401);
    expect(recibir).not.toHaveBeenCalled();
  });

  it('por cabecera, pasa', async () => {
    const res = await llamar({ cabecera: 'el-secreto' });
    expect(res.codigo).toBe(200);
    expect(recibir).toHaveBeenCalled();
  });

  it('por la direccion, tambien', async () => {
    // Hace falta: el webhook global de Evolution se configura con una URL y no
    // deja mandar cabeceras propias.
    const res = await llamar({ query: { s: 'el-secreto' } });
    expect(res.codigo).toBe(200);
    expect(recibir).toHaveBeenCalled();
  });

  it('un secreto parecido no cuela', async () => {
    const res = await llamar({ query: { s: 'el-secreto-' } });
    expect(res.codigo).toBe(401);
  });
});

describe('sin el secreto configurado', () => {
  it('en PRODUCCION se cierra la puerta: 503, no se procesa', async () => {
    // Olvidar la variable no puede dejar la puerta abierta. Antes «si esta
    // puesto se comprueba» significaba justo eso.
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    const res = await llamar();
    expect(res.codigo).toBe(503);
    expect(recibir).not.toHaveBeenCalled();
  });

  it('fuera de produccion se acepta, que es como se trabaja en local', async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'development';
    const res = await llamar();
    expect(res.codigo).toBe(200);
    expect(recibir).toHaveBeenCalled();
  });
});
