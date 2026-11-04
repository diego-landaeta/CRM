import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../src/shared/config/db.js';
import { contactosPorCampus } from '../src/modules/reports/report.model.js';
import { actividadPorComercial } from '../src/modules/mcp/mcp.model.js';
import { tablaActividadPorComercial } from '../src/jobs/correosDelEquipo.js';

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

  it('una empresa no ve a las comerciales de otra', async () => {
    const a = await delDia([pA]);
    expect(a.filas.map((f) => f.user_id)).not.toContain(eva);
    const b = await delDia([pB]);
    expect(b.filas.map((f) => f.user_id)).toEqual([eva]);
  });
});
