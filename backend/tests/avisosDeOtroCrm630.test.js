// scripts/avisos-de-otro-crm-630.mjs: los avisos de Certifex que entraron en el CRM
// equivocado (#630). En producción va de una base (el 360) a otra (ISEIE); aquí, con
// una sola base, «el otro CRM» es un campus sin proyecto (ZAJENA630) y «este» uno con
// proyecto creado para la prueba (ZPROPIA630). Los ficheros entre pasos se escriben a
// mano cuando hace falta fingir que vienen de la otra base.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/shared/config/db.js';
import { proyectosDeCentro } from '../src/modules/certifex/certifex.programa.js';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'avisos-de-otro-crm-630.mjs');
const dir = mkdtempSync(join(tmpdir(), 'avisos630-'));
const base = 630_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
const correo = `alumna.630.${base}@prueba.test`;
const BASE_AQUI = new URL(process.env.DATABASE_URL).pathname.slice(1);

// El script corre como lo correría Diego: un node limpio, sin lo que vitest deja en el
// entorno (NODE_OPTIONS, VITEST_*).
const entorno = (extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_OPTIONS' && !k.startsWith('VITEST'))),
  LOG_LEVEL: 'silent',
  ...extra,
});
const correr = (args, extra) => spawnSync(process.execPath, [SCRIPT, ...args], {
  env: entorno(extra), encoding: 'utf8', cwd: resolve(dirname(SCRIPT), '..'),
});
const escribir = (nombre, datos) => { const f = join(dir, nombre); writeFileSync(f, JSON.stringify(datos)); return f; };
const leerJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const fila = async (id) => (await pool.query('SELECT * FROM certifex_solicitudes WHERE matricula_id = $1', [id])).rows[0];
const insertar = (id, centro, extra = {}) => pool.query(
  `INSERT INTO certifex_solicitudes (matricula_id, centro, curso_ref, curso_nombre, nombre_moodle, email,
     completado_en, completado_nota, completado_recibido_en, recibida_en, email_crm, firma_key)
   VALUES ($1, $2, 12, 'Máster en Prueba', 'Alumna 630', $3, '2026-10-20T08:00:00Z', 8.5, '2026-10-20T08:01:00Z',
     '2026-10-20T08:01:00Z', $4, $5)`,
  [id, centro, extra.email ?? correo, extra.email_crm ?? null, extra.firma_key ?? null],
);

let proyecto;
let lead;
beforeAll(async () => {
  proyecto = (await pool.query(
    `INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ('Zpropia630', $1, 'whk_test') RETURNING id`, [`zpropia630-${base}`])).rows[0].id;
  lead = (await pool.query(
    `INSERT INTO leads (project_id, nombre, email) VALUES ($1, 'Alumna 630', $2) RETURNING id`, [proyecto, correo.toUpperCase()])).rows[0].id;
  await insertar(base, 'ZAJENA630');
  await insertar(base + 1, 'ZAJENA630', { email_crm: 'otra@prueba.test', firma_key: 'firmas/x.png' });
  await insertar(base + 2, 'ZPROPIA630');
});
afterAll(async () => {
  await pool.query('DELETE FROM certifex_solicitudes WHERE matricula_id >= $1 AND matricula_id < $2', [base, base + 10]);
  await pool.query('DELETE FROM leads WHERE id = $1', [lead]);
  await pool.query('DELETE FROM projects WHERE id = $1', [proyecto]);
  await pool.end();
});

describe('la regla del campus, con los centros reales (#630)', () => {
  it('los 8 campus que Certifex manda al 360 (migración 0037 de Certifex) casan; ISEIE no', () => {
    // Los nombres y slugs del 360 (seed y migraciones 079 y 179).
    const del360 = [
      { id: 1, nombre: 'Psiko Aprende', slug: 'psiko-aprende' }, { id: 2, nombre: 'ISEIH', slug: 'iseih' },
      { id: 3, nombre: 'Fono Aprende', slug: 'fono-aprende' }, { id: 4, nombre: 'ISAEG', slug: 'isaeg' },
      { id: 5, nombre: 'ISSLOGG', slug: 'isslogg' }, { id: 6, nombre: 'ISECD', slug: 'isecd' },
      { id: 7, nombre: 'ISEF', slug: 'isef' }, { id: 8, nombre: 'Academia IA', slug: 'academia-ia' },
      { id: 9, nombre: 'ICTESS', slug: 'ictess' },
    ];
    for (const c of ['PSIKO', 'ISEIH', 'FONO', 'ISAEG', 'ISSLOGG', 'ISECD', 'ISEF', 'ACADEMIAIA']) {
      expect(proyectosDeCentro(c, del360).length, c).toBeGreaterThan(0);
    }
    expect(proyectosDeCentro('ISEIE', del360)).toEqual([]);
  });
});

describe('avisos-de-otro-crm-630 (#630)', () => {
  const sacados = join(dir, 'sacados.json');

  it('sacar: solo los de campus que no son de esta base, con lo copiable y lo «tocado aquí»', () => {
    const r = correr(['sacar', '--a-fichero', sacados]);
    expect(r.status, r.stderr).toBe(0);
    const d = leerJson(sacados);
    expect(d).toMatchObject({ paso: 'sacar', origen: BASE_AQUI });
    const mios = d.avisos.filter((a) => a.matricula_id >= base && a.matricula_id < base + 10);
    expect(mios.map((a) => a.matricula_id).sort()).toEqual([base, base + 1]);
    const a = mios.find((x) => x.matricula_id === base);
    expect(a).toMatchObject({ centro: 'ZAJENA630', email: correo, curso_nombre: 'Máster en Prueba', tocada_en_origen: [] });
    expect(Number(a.completado_nota)).toBe(8.5);
    // Lo propio de la base de origen no viaja: solo se avisa.
    expect(a).not.toHaveProperty('lead_id');
    expect(a).not.toHaveProperty('firma_key');
    expect(mios.find((x) => x.matricula_id === base + 1).tocada_en_origen).toEqual(['email_crm', 'firma_key']);
  });

  it('cada paso solo acepta el fichero del paso anterior, y en su base', () => {
    // meter con lo sacado de ESTA misma base: no.
    const mismo = correr(['meter', '--desde-fichero', sacados]);
    expect(mismo.status).toBe(1);
    expect(mismo.stderr).toMatch(/OTRA base/);
    // borrar con el fichero de sacar (sin pasar por meter): no.
    const sinMeter = correr(['borrar', '--desde-fichero', sacados]);
    expect(sinMeter.status).toBe(1);
    expect(sinMeter.stderr).toMatch(/no es el fichero de «meter»/);
    // borrar en una base que no es la de origen: no.
    const otra = correr(['borrar', '--desde-fichero', escribir('otra.json', { paso: 'meter', origen: 'crm_otra', avisos: [] })]);
    expect(otra.status).toBe(1);
    expect(otra.stderr).toMatch(/va en esa base/);
    // meter --aplicar sin decir dónde apuntar lo hecho: no.
    const sinFichero = correr(['meter', '--desde-fichero', sacados, '--aplicar']);
    expect(sinFichero.status).toBe(1);
    expect(sinFichero.stderr).toMatch(/falta --a-fichero/);
  });

  it('meter: el ensayo no escribe; con --aplicar crea, completa lo vacío sin pisar, salta lo ajeno y apunta lo hecho', async () => {
    const a = leerJson(sacados).avisos.find((x) => x.matricula_id === base);
    // Como si vinieran de la otra base, con el campus de esta.
    const desde = escribir('desde.json', { paso: 'sacar', origen: 'crm_otra', avisos: [
      { ...a, matricula_id: base + 3, centro: 'ZPROPIA630' },
      { ...a, matricula_id: base + 2, centro: 'ZPROPIA630', curso_nombre: 'Otro nombre', completado_nota: '9' },
      { ...a, matricula_id: base + 4 },
    ] });
    // base + 2 ya está aquí, pero sin nota ni ficha.
    await pool.query('UPDATE certifex_solicitudes SET completado_nota = NULL, lead_id = NULL WHERE matricula_id = $1', [base + 2]);

    const ensayo = correr(['meter', '--desde-fichero', desde]);
    expect(ensayo.status, ensayo.stderr).toBe(0);
    expect(ensayo.stdout).toMatch(/ENSAYO/);
    expect(await fila(base + 3)).toBeUndefined();

    const metidos = join(dir, 'metidos.json');
    const r = correr(['meter', '--desde-fichero', desde, '--aplicar', '--a-fichero', metidos]);
    expect(r.status, r.stderr).toBe(0);
    const nueva = await fila(base + 3);
    expect(nueva).toMatchObject({ centro: 'ZPROPIA630', email: correo, lead_id: lead, veces: 1, firma_key: null, email_crm: null });
    expect(nueva.completado_recibido_en.toISOString()).toBe('2026-10-20T08:01:00.000Z');
    const completada = await fila(base + 2);
    expect(completada.curso_nombre).toBe('Máster en Prueba'); // lo que había, no se pisa
    expect(Number(completada.completado_nota)).toBe(9); // lo vacío, se rellena
    expect(completada.lead_id).toBe(lead);
    expect(await fila(base + 4)).toBeUndefined(); // ZAJENA630 tampoco es de esta base

    // Lo apuntado: lo que quedó aquí, y nada de lo saltado.
    const hecho = leerJson(metidos);
    expect(hecho).toMatchObject({ paso: 'meter', origen: 'crm_otra', destino: BASE_AQUI });
    expect(hecho.avisos.map((x) => x.matricula_id).sort()).toEqual([base + 2, base + 3]);

    // Otra vez: nada que hacer, y lo que ya estaba también cuenta como hecho.
    const metidos2 = join(dir, 'metidos2.json');
    const otra = correr(['meter', '--desde-fichero', desde, '--aplicar', '--a-fichero', metidos2]);
    expect(otra.stdout).toMatch(/YA ESTABA: 2/);
    expect(leerJson(metidos2).avisos).toHaveLength(2);
  });

  it('borrar: solo lo que «meter» dejó en la otra base; el ensayo no borra; manda el campus de esta base', async () => {
    // Como si «meter» se hubiera hecho en la otra base con lo sacado de aquí: base sí
    // entró allí; base + 1 NO (se saltó o falló), así que no está en el fichero.
    const lista = escribir('metidos-aqui.json', { paso: 'meter', origen: BASE_AQUI, destino: 'crm_otra', avisos: [
      { matricula_id: base, centro: 'ZAJENA630' },
      { matricula_id: base + 2, centro: 'ZAJENA630' }, // en el fichero dice ajeno, pero aquí es ZPROPIA630
      { matricula_id: base + 9, centro: 'ZAJENA630' },
    ] });
    // Las campanas que dejaron esos avisos aquí (lo que se veía desde el admin).
    const campana = async (type, matriculaId, centro) => (await pool.query(
      `INSERT INTO admin_notifications (type, title, metadata) VALUES ($1, 'Prueba 630', $2) RETURNING id`,
      [type, { matriculaId, centro }])).rows[0].id;
    const c = {
      ajena: await campana('certifex_completado', base, 'ZAJENA630'),
      solicitud: await campana('certifex_solicitud', base, 'ZAJENA630'),
      deOtroTipo: await campana('certifex_consulta', base, 'ZAJENA630'),
      sinMeter: await campana('certifex_completado', base + 1, 'ZAJENA630'),
      propia: await campana('certifex_completado', base + 2, 'ZPROPIA630'),
      yaSinFila: await campana('certifex_completado', base + 9, 'ZAJENA630'),
    };
    const quedan = async () => (await pool.query('SELECT id FROM admin_notifications WHERE id = ANY($1::int[])', [Object.values(c)])).rows.map((x) => x.id).sort();
    try {
      const ensayo = correr(['borrar', '--desde-fichero', lista]);
      expect(ensayo.status, ensayo.stderr).toBe(0);
      expect(await fila(base)).toBeDefined();
      expect(await quedan()).toHaveLength(6);

      const r = correr(['borrar', '--desde-fichero', lista, '--aplicar']);
      expect(r.status, r.stderr).toBe(0);
      expect(await fila(base)).toBeUndefined();
      expect(await fila(base + 1)).toBeDefined(); // no la metió nadie: se queda
      expect(await fila(base + 2)).toBeDefined(); // su campus es de esta base: se queda
      expect(r.stdout).toMatch(/YA NO ESTÁ: 1/);
      // Se van las campanas de avisos (terminado y solicitud) de lo que se movió, también
      // si la fila ya no estaba; se quedan las de otro tipo, las de lo no movido y las propias.
      expect(await quedan()).toEqual([c.deOtroTipo, c.sinMeter, c.propia].sort());
    } finally {
      await pool.query('DELETE FROM admin_notifications WHERE id = ANY($1::int[])', [Object.values(c)]);
    }
  });

  it('en producción, --aplicar necesita RECUPERAR_EN_PRODUCCION=1 (en las dos bases)', () => {
    const en = (nombre) => { const u = new URL(process.env.DATABASE_URL); u.pathname = `/${nombre}`; return u.toString(); };
    const meter = correr(['meter', '--desde-fichero', join(dir, 'desde.json'), '--aplicar', '--a-fichero', join(dir, 'x.json')],
      { DATABASE_URL: en('crm_iseie'), RECUPERAR_EN_PRODUCCION: '' });
    expect(meter.status).toBe(1);
    expect(meter.stderr).toMatch(/PRODUCCIÓN/);
    const borrar = correr(['borrar', '--desde-fichero', join(dir, 'metidos-aqui.json'), '--aplicar'],
      { DATABASE_URL: en('crm_prod_db'), RECUPERAR_EN_PRODUCCION: '' });
    expect(borrar.status).toBe(1);
    expect(borrar.stderr).toMatch(/PRODUCCIÓN/);
    expect(existsSync(join(dir, 'x.json'))).toBe(false);
  });
});
