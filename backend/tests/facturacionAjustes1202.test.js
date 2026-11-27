import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * CRM#1202 · Ajustes de facturación automática desde la pantalla.
 *
 * Lo que se defiende:
 *   · lo guardado en la pantalla manda sobre el .env; sin guardar nada, el
 *     .env (o el valor de serie) sigue mandando igual que hoy;
 *   · un campus encendido desde la pantalla factura aunque
 *     FACTURA_AUTOMATICA_CAMPUS no lo liste;
 *   · sin el permiso, PUT/PATCH responden 403 y no tocan nada;
 *   · cada cambio queda en el registro, sin ningún valor;
 *   · los dos vigilantes arrancan aunque el interruptor esté apagado al
 *     iniciar (el arreglo del gotcha de #1202).
 *
 * Sin base: db.js es una base de mentira.
 *   npx vitest run tests/facturacionAjustes1202.test.js
 */

vi.mock('../src/modules/permissions/permissions.service.js', () => import('./helpers/permisosSinBase.js'));
const { registrar } = await import('./helpers/permisosSinBase.js');

const db = vi.hoisted(() => {
  const estado = {};
  function reiniciar() {
    estado.projects = [
      { id: 10, nombre: 'Campus Uno', active: true },
      { id: 20, nombre: 'Campus Dos', active: true },
    ];
    estado.ajustesGlobales = null; // fila de ajustes_facturacion, o null
    estado.campus = new Map(); // project_id -> { activo, updated_by, updated_at }
    estado.registro = []; // user_activity_log
  }
  reiniciar();
  return { estado, reiniciar };
});

vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    const { estado } = db;

    if (s.startsWith('SELECT * FROM ajustes_facturacion WHERE id = 1')) {
      return { rows: estado.ajustesGlobales ? [estado.ajustesGlobales] : [] };
    }
    if (s.startsWith('INSERT INTO ajustes_facturacion')) {
      const [dias, enviar_pdf, revision_admin, auditoria_activa, auditoria_pausar, auditoria_correos, auditoria_desde, updated_by] = params;
      estado.ajustesGlobales = {
        id: 1, dias, enviar_pdf, revision_admin, auditoria_activa, auditoria_pausar,
        auditoria_correos, auditoria_desde, updated_by, updated_at: new Date(),
      };
      return { rows: [] };
    }
    if (s.startsWith('SELECT dias, enviar_pdf, revision_admin FROM ajustes_facturacion WHERE id = 1')) {
      return { rows: estado.ajustesGlobales ? [estado.ajustesGlobales] : [] };
    }
    if (s.startsWith('SELECT pr.id AS project_id, pr.nombre AS campus')) {
      const [projectIds] = params;
      return {
        rows: estado.projects
          .filter((p) => p.active && (!projectIds || projectIds.includes(p.id)))
          .map((p) => ({
            project_id: p.id, campus: p.nombre,
            activo: estado.campus.get(p.id)?.activo ?? null,
            updated_at: estado.campus.get(p.id)?.updated_at ?? null,
          })),
      };
    }
    if (s.startsWith('INSERT INTO factura_automatica_campus')) {
      const [projectId, activo, updatedBy] = params;
      estado.campus.set(projectId, { activo, updated_by: updatedBy, updated_at: new Date() });
      return { rows: [] };
    }
    if (s.startsWith('SELECT activo FROM factura_automatica_campus WHERE project_id = $1')) {
      const [projectId] = params;
      const fila = estado.campus.get(projectId);
      return { rows: fila ? [{ activo: fila.activo }] : [] };
    }
    if (s.startsWith('INSERT INTO user_activity_log')) {
      const [userId, action, details, ip] = params;
      estado.registro.push({ userId, action, details: JSON.parse(details), ip });
      return { rows: [] };
    }
    if (s.startsWith('SELECT l.id, l.action, l.details, l.created_at')) {
      return {
        rows: estado.registro
          .filter((r) => r.action.startsWith('ajuste_facturacion.'))
          .map((r, i) => ({
            id: i + 1, action: r.action, details: r.details, created_at: new Date(), usuario: null, usuario_email: null,
          })),
      };
    }
    return { rows: [] };
  }),
  getClient: vi.fn(),
}));

vi.mock('../src/jobs/latido.js', () => ({ vigilar: vi.fn(() => 'intervalo') }));

const { default: facturacionAjustes } = await import('../src/modules/facturacion-ajustes/index.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');
const { activaEnConDb } = await import('../src/modules/factura-automatica/factura-automatica.config.js');
const { startFacturaAutomaticaScheduler } = await import('../src/jobs/facturaAutomaticaScheduler.js');
const { startFacturacionAuditoriaScheduler } = await import('../src/jobs/facturacionAuditoriaJob.js');
const { historial: registroHistorial } = await import('../src/modules/facturacion-ajustes/facturacion-ajustes.registro.js');
const { vigilar } = await import('../src/jobs/latido.js');

const app = express();
app.use(express.json());
app.use(facturacionAjustes.prefix, facturacionAjustes.router);
app.use(errorHandler);
const request = supertest(app);

const como = (id, role) => ({ Authorization: `Bearer ${jwt.sign(registrar({ userId: id, role }), process.env.JWT_SECRET, { expiresIn: '5m' })}` });
const ADMIN = () => como(1, 'superadmin');
const GESTORA = () => como(2, 'gestor');

const AJUSTES_VACIOS = { dias: null, enviarPdf: null, revisionAdmin: null, auditoriaEstado: null, auditoriaCorreos: [], auditoriaDesde: null };

beforeEach(() => {
  db.reiniciar();
  delete process.env.FACTURA_AUTOMATICA_ACTIVA;
  delete process.env.FACTURA_AUTOMATICA_CAMPUS;
  delete process.env.FACTURA_AUTOMATICA_DIAS;
});
afterEach(() => {
  delete process.env.FACTURA_AUTOMATICA_ACTIVA;
  delete process.env.FACTURA_AUTOMATICA_CAMPUS;
  delete process.env.FACTURA_AUTOMATICA_DIAS;
});

describe('GET /api/facturacion-ajustes', () => {
  it('sin nada guardado, cada campo viene "de serie"', async () => {
    const r = await request.get('/api/facturacion-ajustes').set(ADMIN());
    expect(r.status).toBe(200);
    expect(r.body.data.global.dias).toEqual({ valor: 7, origen: 'serie' });
    expect(r.body.data.global.auditoriaEstado).toEqual({ valor: 'apagada', origen: 'serie' });
  });

  it('sin guardar nada, el .env sigue mandando igual que hoy', async () => {
    process.env.FACTURA_AUTOMATICA_DIAS = '15';
    const r = await request.get('/api/facturacion-ajustes').set(ADMIN());
    expect(r.body.data.global.dias).toEqual({ valor: 15, origen: 'servidor' });
  });

  it('lo guardado en la pantalla manda sobre el .env', async () => {
    process.env.FACTURA_AUTOMATICA_DIAS = '15';
    await request.put('/api/facturacion-ajustes').set(ADMIN()).send({ ...AJUSTES_VACIOS, dias: 3 });
    const r = await request.get('/api/facturacion-ajustes').set(ADMIN());
    expect(r.body.data.global.dias).toEqual({ valor: 3, origen: 'pantalla' });
  });
});

describe('el campus por la pantalla manda sobre la lista del .env', () => {
  it('activaEnConDb ve encendido un campus que el .env no lista', async () => {
    process.env.FACTURA_AUTOMATICA_ACTIVA = 'true';
    process.env.FACTURA_AUTOMATICA_CAMPUS = '999'; // no incluye el 10
    expect(await activaEnConDb({ id: 10 })).toBeFalsy();
    await request.patch('/api/facturacion-ajustes/campus/10').set(ADMIN()).send({ activo: true });
    expect(await activaEnConDb({ id: 10 })).toBe(true);
  });
});

describe('sin el permiso, 403 y no toca nada', () => {
  it('PUT global', async () => {
    const r = await request.put('/api/facturacion-ajustes').set(GESTORA()).send({ ...AJUSTES_VACIOS, dias: 3 });
    expect(r.status).toBe(403);
    expect(db.estado.ajustesGlobales).toBeNull();
  });

  it('PATCH de un campus', async () => {
    const r = await request.patch('/api/facturacion-ajustes/campus/10').set(GESTORA()).send({ activo: true });
    expect(r.status).toBe(403);
    expect(db.estado.campus.size).toBe(0);
  });
});

describe('el registro', () => {
  it('anota el cambio global: qué campos, nunca el valor', async () => {
    await request.put('/api/facturacion-ajustes').set(ADMIN()).send({ ...AJUSTES_VACIOS, dias: 5 });
    const h = await registroHistorial();
    expect(h).toHaveLength(1);
    expect(h[0].action).toBe('ajuste_facturacion.global');
    expect(JSON.stringify(h[0].details)).not.toContain('5');
    expect(h[0].details.campos).toContain('dias');
  });

  it('anota el cambio de un campus: su project_id, nunca el valor', async () => {
    await request.patch('/api/facturacion-ajustes/campus/10').set(ADMIN()).send({ activo: true });
    const h = await registroHistorial();
    expect(h[0].action).toBe('ajuste_facturacion.campus');
    expect(h[0].details.project_id).toBe(10);
    expect(h[0].details).not.toHaveProperty('activo');
  });
});

describe('los dos vigilantes arrancan aunque empiecen apagados (el gotcha de #1202)', () => {
  it('factura automática', () => {
    vigilar.mockClear();
    startFacturaAutomaticaScheduler();
    expect(vigilar).toHaveBeenCalledWith('factura_automatica', expect.any(String), expect.any(Function), expect.any(Number));
  });

  it('auditoría de facturación', () => {
    vigilar.mockClear();
    expect(startFacturacionAuditoriaScheduler()).toBe('intervalo');
    expect(vigilar).toHaveBeenCalledWith(
      'facturacion_auditoria', expect.any(String), expect.any(Function), expect.any(Number), expect.any(Object)
    );
  });
});