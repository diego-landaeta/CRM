import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * «He olvidado la contraseña» (#37).
 *
 * Lo que se fija aqui no es que el correo salga —eso se ve— sino la propiedad
 * que el ticket pone por escrito y que NO se ve mirando la pantalla:
 *
 *   «Que no diga si el correo existe o no — si lo dice, sirve para averiguar
 *    quien trabaja aqui.»
 *
 * Es una regla facil de romper sin querer y de la que nadie se entera: basta
 * que alguien añada un 404 «para que el usuario sepa que se equivoco», y la
 * pantalla de entrar pasa a ser un listado de empleados a base de probar
 * correos. Por eso la comprobacion compara las DOS respuestas enteras, no que
 * cada una sea 200 por su cuenta.
 */

const modelo = {
  findActiveUserByEmail: vi.fn(),
  setRecoveryToken: vi.fn(async () => {}),
  logActivity: vi.fn(async () => {}),
};
vi.mock('../src/modules/auth/auth.model.js', () => modelo);

const enviado = vi.fn(async () => ({ sent: true }));
vi.mock('../src/shared/services/brevo.service.js', () => ({
  sendPasswordResetEmail: (...a) => enviado(...a),
  sendWelcomeUserEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('../src/modules/permissions/permissions.service.js', () => ({
  buildPermissionsMap: vi.fn(), resolveUserView: vi.fn(),
}));

const ctrl = await import('../src/modules/auth/auth.controller.js');

function fingirRes() {
  const res = { codigo: 200, cuerpo: null };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
}

async function pedirRecuperacion(email) {
  const res = fingirRes();
  let error = null;
  await ctrl.forgotPassword({ body: { email } }, res, (e) => { error = e; });
  return { res, error };
}

const LAURA = { id: 4, email: 'laura@empresa.com', nombre: 'Laura Garcia' };

beforeEach(() => {
  modelo.findActiveUserByEmail.mockReset();
  modelo.setRecoveryToken.mockClear();
  modelo.logActivity.mockClear();
  enviado.mockClear();
  enviado.mockResolvedValue({ sent: true });
});

describe('no delata quien tiene cuenta', () => {
  it('contesta EXACTAMENTE lo mismo exista el correo o no', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    const conCuenta = await pedirRecuperacion('laura@empresa.com');

    modelo.findActiveUserByEmail.mockResolvedValue(null);
    const sinCuenta = await pedirRecuperacion('nadie@ejemplo.com');

    expect(conCuenta.res.codigo).toBe(sinCuenta.res.codigo);
    expect(conCuenta.res.cuerpo).toEqual(sinCuenta.res.cuerpo);
    expect(conCuenta.error).toBeNull();
    expect(sinCuenta.error).toBeNull();
  });

  it('con un correo desconocido no se toca la base ni se manda nada', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(null);
    await pedirRecuperacion('nadie@ejemplo.com');
    expect(modelo.setRecoveryToken).not.toHaveBeenCalled();
    expect(enviado).not.toHaveBeenCalled();
  });

  it('si el envio del correo falla, la respuesta NO cambia', async () => {
    // Un error visible aqui distingue un correo real de uno que no lo es
    // igual de bien que un 404.
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    enviado.mockRejectedValue(new Error('Brevo caido'));
    const { res, error } = await pedirRecuperacion('laura@empresa.com');
    expect(error).toBeNull();
    expect(res.codigo).toBe(200);
    expect(res.cuerpo.success).toBe(true);
  });

  it('un correo mal escrito SI se rechaza: «pepe@» no es de nadie', async () => {
    const { error } = await pedirRecuperacion('pepe@');
    expect(error?.statusCode).toBe(400);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });
});

describe('el enlace que se manda', () => {
  it('se guarda hasheado, nunca en claro', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    await pedirRecuperacion('laura@empresa.com');

    const [, hashGuardado] = modelo.setRecoveryToken.mock.calls[0];
    const enClaro = enviado.mock.calls[0][0].setPasswordToken;

    expect(hashGuardado).not.toBe(enClaro);
    expect(hashGuardado).toMatch(/^[0-9a-f]{64}$/);          // sha256
    // Y que el guardado sea el hash DEL que se mando, no otro cualquiera.
    const esperado = (await import('crypto'))
      .createHash('sha256').update(enClaro).digest('hex');
    expect(hashGuardado).toBe(esperado);
  });

  it('caduca a las 24 horas', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    await pedirRecuperacion('laura@empresa.com');

    const [, , expira] = modelo.setRecoveryToken.mock.calls[0];
    const horas = (expira.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(23.9);
    expect(horas).toBeLessThan(24.1);
  });

  it('pedirlo dos veces deja valido solo el ultimo', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    await pedirRecuperacion('laura@empresa.com');
    await pedirRecuperacion('laura@empresa.com');

    const [primero] = modelo.setRecoveryToken.mock.calls.map((c) => c[1]);
    const segundo = modelo.setRecoveryToken.mock.calls[1][1];
    // Son distintos y el segundo PISA al primero en la misma columna, asi que
    // el primer enlace deja de servir. Si no, cada peticion dejaria una llave
    // mas rodando por los buzones.
    expect(primero).not.toBe(segundo);
    expect(modelo.setRecoveryToken.mock.calls[1][0]).toBe(LAURA.id);
  });

  it('queda apuntado en el registro de actividad', async () => {
    modelo.findActiveUserByEmail.mockResolvedValue(LAURA);
    await pedirRecuperacion('laura@empresa.com');
    expect(modelo.logActivity).toHaveBeenCalledWith(
      LAURA.id, 'password_reset_requested', null, null,
    );
  });
});
