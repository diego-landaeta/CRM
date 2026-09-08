import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app.js';
import pool, { query } from '../src/shared/config/db.js';
import * as leadModel from '../src/modules/leads/lead.model.js';

/**
 * El repaso de fin de mes: validar toda la base (#132).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUE SE PRUEBA Y POR QUE ASI
 *
 * Diego pidió el quinto paso del proceso —«Seguimiento de toda la base»— como
 * un correo mensual, y puso la condición que decide si sirve o no:
 *
 *     «Tiene que poder responderse. Si el correo solo enseña, nadie valida
 *      nada: lo abre, lo cierra y sigue igual.»
 *
 * Así que lo que importa aquí no es que el correo salga, sino que **se pueda
 * marcar** y que **el número baje**.
 *
 * LA MIGRACION 147 NO ESTA APLICADA EN ESTA BASE, Y ESO ES EL PUNTO
 *
 * Es como va a estar en el servidor hasta que Diego la aplique. El listado —la
 * pantalla principal del CRM— NO puede caerse por eso, y el correo NO puede
 * salir invitando a validar en una pantalla donde no se puede marcar.
 *
 * Las dos cosas se prueban tal cual, sin fingirlas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const request = supertest(app);
const MARCA = 'valida-test-';
let token;
let proyecto;

beforeAll(async () => {
  const r = await request.post('/api/auth/login')
    .send({ email: 'manuel@empresa.com', password: 'CrmTemp2026!' });
  token = r.body.data.accessToken;
  proyecto = (await query(`SELECT id FROM projects WHERE active ORDER BY id LIMIT 1`)).rows[0].id;
  await query(`DELETE FROM leads WHERE nombre LIKE $1`, [MARCA + '%']);
  await query(
    `INSERT INTO leads (project_id, nombre, email, status, fecha_solicitud, created_at)
     VALUES ($1, $2, $3, 'por_contactar', NOW(), NOW())`,
    [proyecto, MARCA + 'uno', MARCA + 'uno@prueba.local']);
  leadModel._olvidarRevisiones();
});

afterAll(async () => {
  await query(`DELETE FROM leads WHERE nombre LIKE $1`, [MARCA + '%']);
  await pool.end();
});

describe('sin la migracion 147 aplicada', () => {
  it('el listado NO se cae al pedir «sin revisar»', async () => {
    // Es lo que mas importa de todo el fichero. Si el filtro entrara en el
    // WHERE sin comprobar que la tabla existe, Postgres contesta 42P01 y la
    // pantalla principal del CRM deja de cargar — por un filtro que casi nadie
    // usa.
    const res = await request.get(`/api/leads?projectId=${proyecto}&qf=sin-revisar&limit=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('el progreso lo dice, en vez de enseñar ceros', async () => {
    // Ceros y «disponible: true» seria decirle a la gestora que ya lo tiene
    // todo repasado.
    const res = await request.get(`/api/leads/revision?projectId=${proyecto}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disponible).toBe(false);
    expect(res.body.data.aviso).toMatch(/147/);
  });

  it('marcar una ficha contesta 503, no un 201 mentiroso', async () => {
    const lead = (await query(`SELECT id FROM leads WHERE nombre = $1`, [MARCA + 'uno'])).rows[0];
    const res = await request.post(`/api/leads/${lead.id}/revisar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resultado: 'sigue' });

    expect(res.status).toBe(503);
  });

  it('y el correo mensual NO se manda', async () => {
    // Un correo que dice «valida tu base» y lleva a una pantalla donde no se
    // puede marcar se abre una vez. El mes siguiente, ninguna.
    expect(await leadModel.sePuedeRevisar()).toBe(false);
  });
});

describe('el correo mensual', () => {
  it('lleva el enlace a lo que le falta, no la lista de fichas dentro', async () => {
    // Una base son cientos de nombres: dentro del correo no se leen, y ademas
    // quedarian congelados el dia del envio.
    const { _internos } = await import('../src/jobs/resumenDiarioScheduler.js');
    const t = _internos.textoValidacion('Ana', {
      variosProyectos: false,
      bloques: [{ proyecto: { id: 4, nombre: 'Psiko' }, total: 120, revisadas: 40, pendientes: 80 }],
    });

    expect(t).toMatch(/projectId=4&qf=sin-revisar/);
    expect(t).toMatch(/<strong>80<\/strong> por validar/);
  });

  it('dice cuanto lleva, que es lo que hace que se termine', async () => {
    // «Que se note cuanto le queda». Sin el progreso, se marcan tres y se
    // abandona sin saber si vas por el 5 % o por el 90 %.
    const { _internos } = await import('../src/jobs/resumenDiarioScheduler.js');
    const t = _internos.textoValidacion('Ana', {
      variosProyectos: false,
      bloques: [{ proyecto: { id: 4, nombre: 'Psiko' }, total: 120, revisadas: 40, pendientes: 80 }],
    });
    expect(t).toMatch(/Llevas 40 de 120 \(33 %\)/);
  });

  it('si no queda nada, lo dice y no inventa trabajo', async () => {
    const { _internos } = await import('../src/jobs/resumenDiarioScheduler.js');
    const t = _internos.textoValidacion('Ana', {
      variosProyectos: false,
      bloques: [{ proyecto: { id: 4, nombre: 'Psiko' }, total: 120, revisadas: 120, pendientes: 0 }],
    });
    expect(t).toMatch(/repasada este mes/i);
    expect(t).not.toMatch(/qf=sin-revisar/);
  });

  it('con varios proyectos, cada uno con su nombre y su enlace', async () => {
    const { _internos } = await import('../src/jobs/resumenDiarioScheduler.js');
    const t = _internos.textoValidacion('Ana', {
      variosProyectos: true,
      bloques: [
        { proyecto: { id: 1, nombre: 'Psiko Aprende' }, total: 10, revisadas: 2, pendientes: 8 },
        { proyecto: { id: 2, nombre: 'ISEIH' }, total: 5, revisadas: 0, pendientes: 5 },
      ],
    });
    expect(t).toMatch(/Psiko Aprende/);
    expect(t).toMatch(/ISEIH/);
    expect(t).toMatch(/projectId=1&qf=sin-revisar/);
    expect(t).toMatch(/projectId=2&qf=sin-revisar/);
  });
});

describe('lo que se acepta al marcar', () => {
  it('solo los tres resultados que pidio Diego', async () => {
    const { revisarLeadSchema } = await import('../src/modules/leads/lead.validation.js');
    for (const r of ['sigue', 'no_sigue', 'cambio']) {
      expect(revisarLeadSchema.safeParse({ resultado: r }).success).toBe(true);
    }
  });

  it('y nada de texto libre: de esto se cuenta despues', async () => {
    // Con texto libre acabarian conviviendo «no sigue», «No Sigue» y «ya no», y
    // no se podria sumar nada.
    const { revisarLeadSchema } = await import('../src/modules/leads/lead.validation.js');
    expect(revisarLeadSchema.safeParse({ resultado: 'ya no' }).success).toBe(false);
    expect(revisarLeadSchema.safeParse({}).success).toBe(false);
  });
});

describe('la ruta existe y esta protegida', () => {
  it('`/revision` no se la come `/:id`', async () => {
    const res = await request.get('/api/leads/revision')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pendientes');
  });

  it('sin sesion no se entra', async () => {
    expect((await request.get('/api/leads/revision')).status).toBe(401);
    expect((await request.post('/api/leads/1/revisar').send({ resultado: 'sigue' })).status).toBe(401);
  });
});
