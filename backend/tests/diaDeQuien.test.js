import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * De quien es el dia que devuelve `GET /api/leads/today` (#130, parte 1).
 *
 * El endpoint no aceptaba `responsableId`: contestaba siempre con el dia de
 * quien preguntaba. Con eso, un admin que filtraba el dashboard por Laura veia
 * los numeros de Laura en «Lo que toca», en «Ayer y hoy» y en los KPI, y sus
 * PROPIOS recordatorios en «Tu dia de hoy», sin nada que avisara del cambio de
 * sujeto a media pantalla.
 *
 * Lo que se fija aqui es la regla, que es la misma que `asesoraDelInforme()`:
 * una gestora recibe lo suyo pida lo que pida, y quien manda recibe el equipo
 * o el de una sola. Y el detalle que se escapa: al pedir el de una gestora hay
 * que decirle al modelo `role: 'gestor'`, porque es de eso —y no del id— de lo
 * que depende que recorte.
 */

const servicio = { getTodaySummary: vi.fn(async () => ({ nuevos_hoy: 0 })) };
vi.mock('../src/modules/leads/lead.service.js', () => servicio);

const ctrl = await import('../src/modules/leads/lead.controller.js');

function fingirRes() {
  const res = { codigo: 200, cuerpo: null };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
}

async function pedirElDia(req) {
  const res = fingirRes();
  let error = null;
  await ctrl.today(req, res, (e) => { error = e; });
  return { res, error };
}

const LAURA = 12;

beforeEach(() => { servicio.getTodaySummary.mockClear(); });

describe('una gestora', () => {
  it('recibe el suyo', async () => {
    await pedirElDia({ user: { userId: 7, role: 'gestor' }, query: {} });
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, role: 'gestor' }),
    );
  });

  it('pidiendo el de otra, sigue recibiendo el suyo', async () => {
    // El filtro de pantalla no existe para ella, pero la direccion se escribe
    // a mano. Es el punto que el ticket manda resolver en el servidor.
    await pedirElDia({
      user: { userId: 7, role: 'gestor' },
      query: { responsableId: String(LAURA) },
    });
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, role: 'gestor' }),
    );
  });
});

describe('quien manda', () => {
  it('sin pedir a nadie, recibe el del equipo', async () => {
    await pedirElDia({ user: { userId: 9, role: 'admin' }, query: {} });
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, role: 'admin' }),
    );
  });

  it('pidiendo una gestora, recibe el de ella y CON recorte', async () => {
    await pedirElDia({
      user: { userId: 9, role: 'admin' },
      query: { responsableId: String(LAURA) },
    });
    // `role: 'gestor'` no es un descuido: el modelo recorta por el rol, no por
    // el id. Mandando 'admin' devolveria el del equipo con el id puesto al lado
    // y sin efecto, que es un fallo que no se ve — solo salen numeros de mas.
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: LAURA, role: 'gestor' }),
    );
  });

  it('un superadmin funciona igual', async () => {
    await pedirElDia({
      user: { userId: 1, role: 'superadmin' },
      query: { responsableId: String(LAURA) },
    });
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: LAURA, role: 'gestor' }),
    );
  });

  it('una basura en el parametro se ignora, no tumba la pantalla', async () => {
    await pedirElDia({ user: { userId: 9, role: 'admin' }, query: { responsableId: 'pepe' } });
    expect(servicio.getTodaySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, role: 'admin' }),
    );
  });
});
