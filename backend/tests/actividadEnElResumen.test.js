import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../src/shared/config/db.js';
import { contactosPorCampus } from '../src/modules/reports/report.model.js';
import { actividadPorComercial } from '../src/modules/mcp/mcp.model.js';
import { tablaActividadPorComercial, correoDiarioDireccion } from '../src/jobs/correosDelEquipo.js';

/**
 * La actividad por comercial en el resumen de la tarde (#203, parte C), contra
 * Postgres de verdad.
 *
 * El criterio de Diego: «la suma de las filas da el total de contactos del día
 * del propio resumen». Los «Contactos» del resumen (`contactosPorCampus`, la
 * regla de Reportes) cuentan también las notas; la actividad no (ficha del
 * 07/10). Aquí se fija que el total del equipo más las notas da exactamente esa
 * cifra, con el borde del día de Madrid y un prospecto borrado de por medio.
 *
 * Proyectos propios y usuarios INACTIVOS, como en `contactosPorEmpresa.test.js`.
 */

const marca = `ACT203C${Date.now().toString(36)}`;
const ids = { projects: [], users: [], leads: [] };
let pA; let pB; let ana; let dayana; let eva;
const DIA = '2026-10-20';

const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);

async function lead(project, responsable, { borrado = false } = {}) {
  const [l] = await q(
    `INSERT INTO leads (project_id, nombre, email, status, responsable_id, created_at, fecha_solicitud, deleted_at)
     VALUES ($1, $2, $3, 'nuevo', $4, '2026-01-01', '2026-01-01', $5) RETURNING id`,
    [project, `${marca} lead`, `${marca}-${Math.random().toString(36).slice(2, 8)}@act.test`, responsable,
      borrado ? '2026-02-01' : null]);
  ids.leads.push(l.id);
  return l.id;
}
const contacto = (leadId, tipo, quien, fecha) => q(
  'INSERT INTO lead_interactions (lead_id, tipo, nota, created_by, fecha) VALUES ($1, $2, \'x\', $3, $4)',
  [leadId, tipo, quien, fecha]);

beforeAll(async () => {
  for (const clave of ['A', 'B']) {
    const [p] = await q(
      `INSERT INTO projects (nombre, slug, webhook_api_key, type, es_prueba) VALUES ($1, $2, $3, 'crm', TRUE) RETURNING id`,
      [`${marca} campus ${clave}`, `${marca}-${clave}`.toLowerCase(), `whk_${marca}_${clave}`]);
    ids.projects.push(p.id);
  }
  [pA, pB] = ids.projects;
  const mk = async (nombre) => (await q(
    `INSERT INTO users (nombre, email, password_hash, role, active) VALUES ($1, $2, 'x', 'gestor', FALSE) RETURNING id`,
    [`${marca} ${nombre}`, `${nombre.toLowerCase()}@${marca.toLowerCase()}.test`]))[0].id;
  ana = await mk('Ana');
  dayana = await mk('Dayana');
  eva = await mk('Eva');
  ids.users.push(ana, dayana, eva);

  const deDayana = await lead(pA, dayana);
  const deAna = await lead(pA, ana);
  const borrado = await lead(pA, dayana, { borrado: true });
  const deEva = await lead(pB, eva);

  // Ana llama a un prospecto de Dayana: es actividad de Ana.
  await contacto(deDayana, 'llamada', ana, `${DIA}T09:00:00Z`);
  await contacto(deDayana, 'whatsapp', dayana, `${DIA}T10:00:00Z`);
  await contacto(deAna, 'email', ana, `${DIA}T11:00:00Z`);
  await contacto(deAna, 'nota', ana, `${DIA}T12:00:00Z`);            // nota: no es contacto
  await contacto(deDayana, 'nota', dayana, `${DIA}T13:00:00Z`);
  // Las 22:30 UTC del día anterior ya son las 00:30 del día en Madrid: cuenta.
  await contacto(deAna, 'llamada', ana, '2026-10-19T22:30:00Z');
  // Y las 22:30 UTC del día son ya el siguiente en Madrid: no cuenta.
  await contacto(deAna, 'llamada', ana, `${DIA}T22:30:00Z`);
  await contacto(borrado, 'llamada', dayana, `${DIA}T09:30:00Z`);    // prospecto borrado
  await contacto(deEva, 'llamada', eva, `${DIA}T09:00:00Z`);         // otra empresa
});

afterAll(async () => {
  await q('DELETE FROM lead_interactions WHERE lead_id = ANY($1::int[])', [ids.leads]);
  await q('DELETE FROM leads WHERE id = ANY($1::int[])', [ids.leads]);
  await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]);
  await pool.end();
});

const delDia = (projectIds) => actividadPorComercial({ projectIds, desde: DIA, hasta: DIA });
const contactosDelResumen = async (projectIds) => (await contactosPorCampus({ projectIds, from: DIA, to: DIA }))
  .reduce((t, c) => t + c.contactos, 0);

describe('actividad por comercial en el resumen de la tarde', () => {
  it('el total del equipo más las notas da los contactos del día del resumen', async () => {
    const a = await delDia([pA]);
    const contactos = await contactosDelResumen([pA]);
    expect(contactos).toBe(6);                       // 4 contactos + 2 notas
    expect(a.equipo.toques + a.equipo.notas).toBe(contactos);
    // Y las filas suman el total del equipo.
    expect(a.filas.reduce((t, f) => t + f.toques, 0)).toBe(a.equipo.toques);
  });

  it('la llamada de Ana a un prospecto de Dayana cuenta para Ana', async () => {
    const a = await delDia([pA]);
    const fila = (id) => a.filas.find((f) => f.user_id === id);
    expect(fila(ana)).toMatchObject({ llamadas: 2, correos: 1, toques: 3, notas: 1 });
    expect(fila(dayana)).toMatchObject({ llamadas: 0, whatsapp: 1, toques: 1, notas: 1 });
  });

  it('la tabla del correo lo dice con esas cifras', async () => {
    const a = await delDia([pA]);
    const html = tablaActividadPorComercial(a, await contactosDelResumen([pA]));
    expect(html).toContain('4 contactos y 2 notas suman los 6 contactos del día');
  });

  it('una empresa no cuenta lo que se hizo en otra', async () => {
    const a = await delDia([pA]);
    expect(a.filas.map((f) => f.user_id)).not.toContain(eva);
    const b = await delDia([pB]);
    expect(b.filas.map((f) => f.user_id)).toEqual([eva]);
  });
});

/**
 * El correo ENTERO, de dos admins de empresas distintas, contra la base: sin
 * nada simulado entre la consulta y el HTML. Campus de verdad (no de pruebas),
 * porque el resumen no cuenta los de pruebas; admins INACTIVOS, como arriba.
 */
describe('el «Resumen del día» de verdad, de dos admins', () => {
  const m = `${marca}R`;
  const r = { projects: [], users: [], leads: [], issuers: [] };
  let adminUno; let adminDos; let ana2; let dayana2; let eva2;
  // Un día fijo, a mediodía: es el mismo día en UTC, en Madrid y en Caracas,
  // así que la prueba no depende de la hora a la que se corra.
  const DIA_R = '2026-10-21';
  const ahora = new Date(`${DIA_R}T12:00:00Z`);
  const aLas = (hora) => `${DIA_R}T${hora}:00Z`;

  beforeAll(async () => {
    const soc = async (nombre) => (await q(
      `INSERT INTO invoice_issuers (razon_social, nif) VALUES ($1, $2) RETURNING id`,
      [`${m} ${nombre}`, `${m}${nombre}`.slice(0, 20)]))[0].id;
    const sUno = await soc('Uno'); const sDos = await soc('Dos');
    r.issuers.push(sUno, sDos);
    const campus = async (clave, sociedad) => {
      const [p] = await q(
        `INSERT INTO projects (nombre, slug, webhook_api_key, type, sociedad_emisora_id) VALUES ($1, $2, $3, 'crm', $4) RETURNING id`,
        [`${m} campus ${clave}`, `${m}-${clave}`.toLowerCase(), `whk_${m}_${clave}`, sociedad]);
      r.projects.push(p.id);
      return p.id;
    };
    const cUno = await campus('U1', sUno); const cDos = await campus('D1', sDos);
    const mk = async (rol, nombre, campusIds) => {
      const [u] = await q(
        `INSERT INTO users (nombre, email, password_hash, role, active) VALUES ($1, $2, 'x', $3, FALSE) RETURNING id, nombre, role`,
        [`${m} ${nombre}`, `${nombre.toLowerCase()}@${m.toLowerCase()}.test`, rol]);
      for (const c of campusIds) await q('INSERT INTO user_projects (user_id, project_id, active) VALUES ($1, $2, TRUE)', [u.id, c]);
      r.users.push(u.id);
      return u;
    };
    adminUno = await mk('admin', 'AdminUno', [cUno]);
    adminDos = await mk('admin', 'AdminDos', [cDos]);
    ana2 = (await mk('gestor', 'Ana', [cUno])).id;
    dayana2 = (await mk('gestor', 'Dayana', [cUno])).id;
    eva2 = (await mk('gestor', 'Eva', [cDos])).id;
    const leadDe = async (project, responsable) => {
      const [l] = await q(
        `INSERT INTO leads (project_id, nombre, email, status, responsable_id, created_at, fecha_solicitud)
         VALUES ($1, $2, $3, 'nuevo', $4, '2026-01-01', '2026-01-01') RETURNING id`,
        [project, `${m} lead`, `${m}-${Math.random().toString(36).slice(2, 8)}@act.test`, responsable]);
      r.leads.push(l.id);
      return l.id;
    };
    const deDayana = await leadDe(cUno, dayana2);
    const deEva = await leadDe(cDos, eva2);
    // Ana llama a un prospecto de Dayana y apunta una nota; Eva llama en la
    // empresa Dos.
    await contacto(deDayana, 'llamada', ana2, aLas('10:00'));
    await contacto(deDayana, 'nota', ana2, aLas('10:05'));
    await contacto(deEva, 'llamada', eva2, aLas('10:00'));
  });

  afterAll(async () => {
    await q('DELETE FROM lead_interactions WHERE lead_id = ANY($1::int[])', [r.leads]);
    await q('DELETE FROM leads WHERE id = ANY($1::int[])', [r.leads]);
    await q('DELETE FROM user_projects WHERE user_id = ANY($1::int[])', [r.users]);
    await q('DELETE FROM users WHERE id = ANY($1::int[])', [r.users]);
    await q('DELETE FROM projects WHERE id = ANY($1::int[])', [r.projects]);
    await q('DELETE FROM invoice_issuers WHERE id = ANY($1::int[])', [r.issuers]);
  });

  const actividad = (html) => {
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const i = t.indexOf('Actividad por comercial');
    return i < 0 ? '' : t.slice(i, t.indexOf('Abrir Reportes'));
  };

  it('el admin de la Uno ve a Ana con la llamada, y la nota cuadra con los contactos', async () => {
    const t = actividad((await correoDiarioDireccion(adminUno, ahora)).html);
    expect(t).toContain(`${m} Ana 1 0 0 1 1`);
    expect(t).not.toContain(`${m} Dayana`);
    expect(t).toContain('1 contacto y 1 nota suman los 2 contactos del día');
  });

  it('el admin de la Dos no ve lo que se hizo en la Uno', async () => {
    const t = actividad((await correoDiarioDireccion(adminDos, ahora)).html);
    expect(t).toContain(`${m} Eva 1 0 0 1 1`);
    expect(t).not.toContain(`${m} Ana`);
  });
});
