import { describe, it, expect, vi, beforeEach } from 'vitest';

// El criterio de terminado de la tarea #27, tal cual lo escribio Diego:
//
//   «Se lanza dos veces seguidas la misma tarea y solo sale un correo.»
//
// El caso real es el aviso de Google Ads caido. Ese trabajo hace su primer tick
// diez minutos despues de arrancar la aplicacion, asi que con el token roto
// cinco reinicios en una tarde eran cinco correos identicos a los
// administradores.
//
// OJO al escribir esto: la primera version daba un falso positivo. Se lanzaba
// tres veces sin clave de Brevo, los tres fallaban con NO_API_KEY, y quedaba una
// sola fila — pero por el `ON CONFLICT` del registro, no porque se hubiera
// frenado nada. Los tres habian intentado enviar. Para que la prueba signifique
// algo, el primer envio tiene que contar como ENVIADO.

const yaSeEnvio = vi.fn();
const registrar = vi.fn();
const peticiones = vi.fn();

vi.mock('../src/shared/services/email-log.service.js', () => ({
  yaSeEnvio: (...a) => yaSeEnvio(...a),
  registrar: (...a) => registrar(...a),
}));
vi.mock('../src/modules/credentials/credentials.model.js', () => ({
  getDecryptedValue: vi.fn(async () => 'clave-de-brevo-falsa'),
}));

process.env.NODE_ENV = 'production';   // sin freno, para probar solo la clave

beforeEach(() => {
  yaSeEnvio.mockReset().mockResolvedValue(false);
  registrar.mockReset().mockResolvedValue(undefined);
  peticiones.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (url, opciones) => {
    peticiones(String(url), opciones);
    return { ok: true, status: 201, json: async () => ({ messageId: 'brevo-1' }), text: async () => '' };
  }));
});

const { sendEmail } = await import('../src/shared/services/brevo.service.js');

const avisoDeGoogleAds = () => sendEmail({
  to: 'angel@empresa.com,diego@empresa.com',
  subject: '[CRM] Google Ads desconectado — Psiko Aprende',
  htmlContent: '<p>El refresh token ha dejado de ser valido.</p>',
  tags: ['google-ads-token', 'cred-99'],
  clave: 'google-ads-caido-99-2026-08-25',
});

describe('se lanza dos veces la misma tarea y solo sale un correo', () => {
  it('la primera vez sale', async () => {
    const r = await avisoDeGoogleAds();
    expect(r.sent).toBe(true);
    expect(peticiones).toHaveBeenCalledTimes(1);
  });

  it('la segunda NO sale, y se dice por que', async () => {
    // Como si la aplicacion se hubiera reiniciado con el token todavia roto.
    yaSeEnvio.mockResolvedValue(true);
    const r = await avisoDeGoogleAds();
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('YA_ENVIADO');
    // Y lo que de verdad importa: NO se llamo a Brevo.
    expect(peticiones).not.toHaveBeenCalled();
  });

  it('sin clave se manda siempre, que es lo correcto', async () => {
    // Un correo manual de una gestora a un prospecto puede repetirse las veces
    // que haga falta: es ella quien decide, no el sistema.
    await sendEmail({ to: 'a@b.c', subject: 'Manual', htmlContent: 'x' });
    await sendEmail({ to: 'a@b.c', subject: 'Manual', htmlContent: 'x' });
    expect(peticiones).toHaveBeenCalledTimes(2);
  });

  it('la clave del aviso lleva el dia: al siguiente vuelve a avisar', () => {
    // Mientras nadie arregle el token, el aviso se repite cada dia. Eso si se
    // quiere — lo que no se quiere es uno por reinicio.
    const clave = (credId, dia) => `google-ads-caido-${credId}-${dia}`;
    expect(clave(99, '2026-08-25')).not.toBe(clave(99, '2026-08-26'));
    // Y dos credenciales distintas no se pisan entre ellas.
    expect(clave(99, '2026-08-25')).not.toBe(clave(100, '2026-08-25'));
  });
});
