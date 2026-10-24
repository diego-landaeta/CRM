import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Integraciones, solo en los campus de quien llama (QA de Diego, 22/10, punto 5).
 *
 * «Integraciones no se acota por campus: con Moodle, un admin de otra empresa
 * podría cambiar la URL de un campus y quedarse con el token de administrador
 * del Moodle. Antes de conectar un Moodle real.»
 *
 * Pasa por las rutas de verdad (token, rol y campus), no solo por el
 * controlador: lo que se fija es que la puerta esté puesta.
 */

// Ana es admin del campus 10 (CEDIA). El 20 es de otra empresa.
const CAMPUS_DE = { 2: [10] };

vi.mock('../src/shared/config/db.js', () => ({
  getClient: vi.fn(),
  query: vi.fn(async (sql, params = []) => {
    if (sql.includes('FROM user_projects WHERE user_id = $1 AND project_id = $2')) {
      return { rows: (CAMPUS_DE[params[0]] || []).includes(Number(params[1])) ? [{ '?column?': 1 }] : [] };
    }
    return { rows: [] };
  }),
}));

const fila = (projectId, provider) => ({ id: 1, project_id: projectId, provider, active: true, config_public: {} });

vi.mock('../src/modules/integrations/integrations.model.js', () => ({
  get: vi.fn(async (projectId, provider) => fila(projectId, provider)),
  listByProject: vi.fn(async (projectId) => [fila(projectId, 'moodle')]),
  upsert: vi.fn(async ({ projectId, provider }) => fila(projectId, provider)),
  recordTestResult: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}));

const model = await import('../src/modules/integrations/integrations.model.js');
const { default: rutas } = await import('../src/modules/integrations/integrations.routes.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/integrations', rutas);
app.use(errorHandler);
const api = supertest(app);

const como = (userId, role) => ({ Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '5m' })}` });
const ANA = como(2, 'admin');
const MANUEL = como(1, 'superadmin');

/** Ninguna llamada al modelo con el campus 20. */
function noTocoElCampus20() {
  for (const fn of [model.get, model.listByProject, model.upsert, model.recordTestResult, model.remove]) {
    for (const [arg] of fn.mock.calls) {
      const pid = typeof arg === 'object' && arg !== null ? arg.projectId : arg;
      expect(Number(pid)).not.toBe(20);
    }
  }
}

beforeEach(() => { vi.clearAllMocks(); });

describe('un admin, en su campus', () => {
  it('ve, guarda, prueba y borra', async () => {
    expect((await api.get('/api/integrations?projectId=10').set(ANA)).status).toBe(200);
    expect((await api.get('/api/integrations/moodle?projectId=10').set(ANA)).status).toBe(200);
    expect((await api.put('/api/integrations').set(ANA).send({ projectId: 10, provider: 'brevo', active: true })).status).toBe(200);
    expect((await api.delete('/api/integrations/moodle?projectId=10').set(ANA)).status).toBe(200);
    expect(model.upsert).toHaveBeenCalledWith(expect.objectContaining({ projectId: 10, provider: 'brevo' }));
    expect(model.remove).toHaveBeenCalledWith(10, 'moodle');
  });
});

describe('un admin, en el campus de otra empresa', () => {
  it('no ve la lista ni la integración de Moodle', async () => {
    expect((await api.get('/api/integrations?projectId=20').set(ANA)).status).toBe(403);
    expect((await api.get('/api/integrations/moodle?projectId=20').set(ANA)).status).toBe(403);
    noTocoElCampus20();
  });

  it('no puede cambiar la URL ni el token del Moodle', async () => {
    const r = await api.put('/api/integrations').set(ANA)
      .send({ projectId: 20, provider: 'moodle', api_key: 'token-de-otro-12345', config_public: { url: 'https://atacante.example.com' } });
    expect(r.status).toBe(403);
    expect(model.upsert).not.toHaveBeenCalled();
  });

  it('no puede probarla ni borrarla', async () => {
    expect((await api.post('/api/integrations/moodle/test?projectId=20').set(ANA)).status).toBe(403);
    expect((await api.delete('/api/integrations/moodle?projectId=20').set(ANA)).status).toBe(403);
    expect(model.remove).not.toHaveBeenCalled();
    noTocoElCampus20();
  });

  it('su campus en el cuerpo y el ajeno en la URL no le abren el ajeno', async () => {
    await api.get('/api/integrations/moodle?projectId=20').set(ANA).send({ projectId: 10 });
    await api.delete('/api/integrations/moodle?projectId=20').set(ANA).send({ projectId: 10 });
    await api.post('/api/integrations/moodle/test?projectId=20').set(ANA).send({ projectId: 10 });
    noTocoElCampus20();
  });
});

describe('un projectId que no es un número', () => {
  it('da 400, como antes, en vez de llegar a la base (allí se quedaba sin respuesta)', async () => {
    const db = await import('../src/shared/config/db.js');
    for (const r of [
      api.get('/api/integrations?projectId=abc').set(ANA),
      api.get('/api/integrations/moodle?projectId=99999999999').set(ANA),
      api.put('/api/integrations').set(ANA).send({ projectId: 'abc', provider: 'brevo', active: true }),
    ]) {
      expect((await r).status).toBe(400);
    }
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('el super admin', () => {
  it('sigue entrando en cualquier campus', async () => {
    expect((await api.get('/api/integrations/moodle?projectId=20').set(MANUEL)).status).toBe(200);
    expect(model.get).toHaveBeenCalledWith(20, 'moodle');
  });
});
