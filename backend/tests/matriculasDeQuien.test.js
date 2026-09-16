import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * De quién son las matrículas que devuelve el listado (#40, y el #109 otra vez).
 *
 * El #109 —«una gestora ve leads que no son suyos»— se cerró diciendo que había
 * que repasar TODAS las puertas por las que se llega a un lead o a su historial.
 * Ésta quedó sin repasar: `/api/matriculas` devolvía las de todo el proyecto a
 * cualquier gestora, con nombre, correo, teléfono y DNI de gente que no lleva.
 *
 * Y pesa más que en los leads, porque la matrícula arrastra DNI, título y firma
 * escaneados.
 *
 * Salió montando el filtro «por gestora» que pide el #40: añadirlo sin este
 * recorte era darle el buscador que le faltaba para leer las ajenas. Por eso
 * las dos cosas se prueban juntas.
 */

const modelo = {
  findAll: vi.fn(async () => ({ matriculas: [], total: 0, page: 1, limit: 50, totalPages: 0 })),
  getStats: vi.fn(async () => ({ total: 0, pendientes: 0, validadas: 0, rechazadas: 0 })),
  findById: vi.fn(),
};
vi.mock('../src/modules/matriculas/matricula.model.js', () => modelo);
vi.mock('../src/shared/services/localStorage.service.js', () => ({
  saveLocal: vi.fn(), getLocal: vi.fn(), deleteLocal: vi.fn(),
}));

const ctrl = await import('../src/modules/matriculas/matricula.controller.js');

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

const LAURA = 4;
const ANGEL = 3;

const listar = (user, query = {}) =>
  llamar(ctrl.list, { user, query: { projectId: '1', ...query } });

beforeEach(() => {
  modelo.findAll.mockClear();
  modelo.getStats.mockClear();
  modelo.findById.mockReset();
});

describe('el listado recorta por rol', () => {
  it('una gestora solo pide las suyas', async () => {
    await listar({ userId: LAURA, role: 'gestor' });
    expect(modelo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ responsableId: LAURA }),
    );
  });

  it('pidiendo las de otra, sigue recibiendo las suyas', async () => {
    await listar({ userId: LAURA, role: 'gestor' }, { responsableId: String(ANGEL) });
    expect(modelo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ responsableId: LAURA }),
    );
  });

  it('quien manda ve el proyecto entero si no pide a nadie', async () => {
    await listar({ userId: 9, role: 'admin' });
    expect(modelo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ responsableId: null }),
    );
  });

  it('quien manda puede pedir las de una', async () => {
    await listar({ userId: 9, role: 'admin' }, { responsableId: String(LAURA) });
    expect(modelo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ responsableId: LAURA }),
    );
  });

  it('los contadores de la cabecera recortan IGUAL que la lista', async () => {
    // Si no, una gestora lee «40 matrículas» sobre una tabla de cinco filas.
    // Eso se reporta como «no me cargan», y lo que pasa es que las otras
    // treinta y cinco no son suyas.
    await listar({ userId: LAURA, role: 'gestor' });
    expect(modelo.getStats).toHaveBeenCalledWith(1, LAURA);
  });
});

describe('los filtros del #40', () => {
  it('pasan producto, fechas y orden al modelo', async () => {
    await listar({ userId: 9, role: 'admin' }, {
      productoId: '7', from: '2026-09-01', to: '2026-09-30', sort: 'nombre',
    });
    expect(modelo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      productoId: 7, from: '2026-09-01', to: '2026-09-30', sort: 'nombre',
    }));
  });

  it('sin filtros no se inventa ninguno', async () => {
    await listar({ userId: 9, role: 'admin' });
    expect(modelo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      productoId: null, from: null, to: null,
    }));
  });
});

describe('las que se alcanzan por su id', () => {
  const DE_LAURA = { id: 1, responsable_id: LAURA, dni: 'X' };

  it('una gestora no abre la de otra', async () => {
    modelo.findById.mockResolvedValue({ id: 1, responsable_id: ANGEL });
    const { error } = await llamar(ctrl.getById, {
      user: { userId: LAURA, role: 'gestor' }, params: { id: '1' },
    });
    expect(error?.statusCode).toBe(403);
    expect(error?.code).toBe('NO_ES_TUYA');
  });

  it('la suya sí', async () => {
    modelo.findById.mockResolvedValue(DE_LAURA);
    const { res, error } = await llamar(ctrl.getById, {
      user: { userId: LAURA, role: 'gestor' }, params: { id: '1' },
    });
    expect(error).toBeNull();
    expect(res.cuerpo.data).toEqual(DE_LAURA);
  });

  it('quien manda abre cualquiera', async () => {
    modelo.findById.mockResolvedValue({ id: 1, responsable_id: ANGEL });
    const { error } = await llamar(ctrl.getById, {
      user: { userId: 9, role: 'admin' }, params: { id: '1' },
    });
    expect(error).toBeNull();
  });

  it('una que no existe da 404, no 403', async () => {
    // Importa el orden: si contestara 403 a lo inexistente, probando números se
    // sabría cuáles existen sin verlas.
    modelo.findById.mockResolvedValue(null);
    const { error } = await llamar(ctrl.getById, {
      user: { userId: LAURA, role: 'gestor' }, params: { id: '999' },
    });
    expect(error?.statusCode).toBe(404);
  });
});
