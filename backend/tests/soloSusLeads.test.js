import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * «Gestor: solo ve proyectos asignados, solo sus leads.»
 *
 * Es la regla escrita en la guia del proyecto, y el controlador la aplicaba en
 * unos sitios y en otros no. Comprobado contra la API de verdad: Laura, gestora,
 * cambio a «convertido» un lead de Diego y recibio un 200. Anadir una NOTA a ese
 * mismo lead si le daba 403 — o sea que el manejador de al lado ya lo miraba y
 * este no.
 *
 * De todos los campos, el estado es el peor para dejar suelto: «convertido» es
 * lo que alimenta el informe de ventas, asi que una gestora podia apuntarse —o
 * estropear— la conversion de otra sin dejar mas rastro que el cambio.
 *
 * Y el recordatorio, por lo mismo: uno puesto en el lead de otra le aparece a
 * ELLA en su cola del dia.
 *
 * Esta prueba fija los dos, y lo que NO debe cambiar: quien administra sigue
 * pudiendo, que es justo para lo que esta.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));

const servicio = {
  changeStatus: vi.fn(async () => ({ previous: 'nuevo', current: 'convertido' })),
  addReminder: vi.fn(async () => ({ id: 1 })),
};
vi.mock('../src/modules/leads/lead.service.js', () => servicio);

const ctrl = await import('../src/modules/leads/lead.controller.js');

/** El lead 1 es de la usuaria 2. */
const DE_OTRA = 2;

function fingirRes() {
  const res = { codigo: 200, cuerpo: null };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
}

async function llamar(handler, req) {
  const res = fingirRes();
  let error = null;
  await handler(req, res, (e) => { error = e; });
  return { res, error };
}

const comoGestora = (userId) => ({
  user: { userId, role: 'gestor' },
  params: { id: '1' },
  body: { status: 'convertido', fecha_recordatorio: '2026-12-01', nota: 'x' },
  query: {},
});

const comoAdmin = () => ({
  user: { userId: 9, role: 'admin' },
  params: { id: '1' },
  body: { status: 'convertido', fecha_recordatorio: '2026-12-01', nota: 'x' },
  query: {},
});

beforeEach(() => {
  query.mockReset();
  // Lo unico que se consulta es de quien es el lead.
  query.mockResolvedValue({ rows: [{ responsable_id: DE_OTRA }] });
  servicio.changeStatus.mockClear();
  servicio.addReminder.mockClear();
});

describe('el estado de un lead', () => {
  it('una gestora NO puede cambiar el de otra', async () => {
    const { error } = await llamar(ctrl.changeStatus, comoGestora(4));
    expect(error?.code, 'una gestora cambiaba el estado de un lead ajeno').toBe('NO_ES_TUYO');
    expect(error?.statusCode).toBe(403);
    expect(servicio.changeStatus, 'llego a escribirse').not.toHaveBeenCalled();
  });

  it('el suyo SI', async () => {
    const { error } = await llamar(ctrl.changeStatus, comoGestora(DE_OTRA));
    expect(error).toBeNull();
    expect(servicio.changeStatus).toHaveBeenCalled();
  });

  it('quien administra sigue pudiendo con cualquiera', async () => {
    const { error } = await llamar(ctrl.changeStatus, comoAdmin());
    expect(error).toBeNull();
    expect(servicio.changeStatus).toHaveBeenCalled();
  });
});

describe('los recordatorios', () => {
  it('una gestora no se los pone en la cola a otra', async () => {
    const { error } = await llamar(ctrl.addReminder, comoGestora(4));
    expect(error?.code).toBe('NO_ES_TUYO');
    expect(servicio.addReminder).not.toHaveBeenCalled();
  });

  it('en los suyos si', async () => {
    const { error } = await llamar(ctrl.addReminder, comoGestora(DE_OTRA));
    expect(error).toBeNull();
    expect(servicio.addReminder).toHaveBeenCalled();
  });
});

describe('un lead que no existe', () => {
  it('se dice que no esta, no que es de otra', async () => {
    query.mockResolvedValue({ rows: [] });
    const { error } = await llamar(ctrl.changeStatus, comoGestora(4));
    expect(error?.statusCode).toBe(404);
  });
});
