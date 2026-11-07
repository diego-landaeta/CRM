// scripts/avisos-de-otro-crm-630.mjs: los avisos de Certifex que entraron en el CRM
// equivocado (#630). En producción va de una base (el 360) a otra (ISEIE); aquí, con
// una sola base, «el otro CRM» es un campus sin proyecto (ZAJENA630) y «este» uno con
// proyecto creado para la prueba (ZPROPIA630).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/shared/config/db.js';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'avisos-de-otro-crm-630.mjs');
const dir = mkdtempSync(join(tmpdir(), 'avisos630-'));
const base = 630_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
const correo = `alumna.630.${base}@prueba.test`;

// El script corre como lo correría Diego: un node limpio, sin lo que vitest deja en el
// entorno (NODE_OPTIONS, VITEST_*).
const entorno = (extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_OPTIONS' && !k.startsWith('VITEST'))),
  LOG_LEVEL: 'silent',
  ...extra,
});
const correr = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], {
  env: entorno(), encoding: 'utf8', cwd: resolve(dirname(SCRIPT), '..'),
});
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

describe('avisos-de-otro-crm-630 (#630)', () => {
  const fichero = join(dir, 'avisos.json');

  it('sacar: solo los de campus que no son de esta base, con lo copiable y lo «tocado aquí»', () => {
    const r = correr('sacar', '--a-fichero', fichero);
    expect(r.status, r.stderr).toBe(0);
    const { avisos } = JSON.parse(readFileSync(fichero, 'utf8'));
    const mios = avisos.filter((a) => a.matricula_id >= base && a.matricula_id < base + 10);
    expect(mios.map((a) => a.matricula_id).sort()).toEqual([base, base + 1]);
    const a = mios.find((x) => x.matricula_id === base);
    expect(a).toMatchObject({ centro: 'ZAJENA630', email: correo, curso_nombre: 'Máster en Prueba', tocada_en_origen: [] });
    expect(Number(a.completado_nota)).toBe(8.5);
    // Lo propio de la base de origen no viaja: solo se avisa.
    expect(a).not.toHaveProperty('lead_id');
    expect(a).not.toHaveProperty('firma_key');
    expect(mios.find((x) => x.matricula_id === base + 1).tocada_en_origen).toEqual(['email_crm', 'firma_key']);
  });

  it('meter: el ensayo no escribe; con --aplicar crea, completa lo vacío sin pisar y salta lo ajeno', async () => {
    // Como si llegaran a la base de su campus: el mismo aviso, con el campus de aquí.
    const { avisos } = JSON.parse(readFileSync(fichero, 'utf8'));
    const a = avisos.find((x) => x.matricula_id === base);
    const destino = join(dir, 'destino.json');
    writeFileSync(destino, JSON.stringify({ avisos: [
      { ...a, matricula_id: base + 3, centro: 'ZPROPIA630' },
      { ...a, matricula_id: base + 2, centro: 'ZPROPIA630', curso_nombre: 'Otro nombre', completado_nota: '9' },
      { ...a, matricula_id: base + 4 },
    ] }));
    // base + 2 ya está aquí, pero sin nota ni ficha.
    await pool.query('UPDATE certifex_solicitudes SET completado_nota = NULL, lead_id = NULL WHERE matricula_id = $1', [base + 2]);

    const ensayo = correr('meter', '--desde-fichero', destino);
    expect(ensayo.status, ensayo.stderr).toBe(0);
    expect(ensayo.stdout).toMatch(/ENSAYO/);
    expect(await fila(base + 3)).toBeUndefined();

    const r = correr('meter', '--desde-fichero', destino, '--aplicar');
    expect(r.status, r.stderr).toBe(0);
    const nueva = await fila(base + 3);
    expect(nueva).toMatchObject({ centro: 'ZPROPIA630', email: correo, lead_id: lead, veces: 1, firma_key: null, email_crm: null });
    expect(nueva.completado_recibido_en.toISOString()).toBe('2026-10-20T08:01:00.000Z');
    const completada = await fila(base + 2);
    expect(completada.curso_nombre).toBe('Máster en Prueba'); // lo que había, no se pisa
    expect(Number(completada.completado_nota)).toBe(9); // lo vacío, se rellena
    expect(completada.lead_id).toBe(lead);
    expect(await fila(base + 4)).toBeUndefined(); // ZAJENA630 tampoco es de esta base

    // Otra vez: nada que hacer.
    const otra = correr('meter', '--desde-fichero', destino, '--aplicar');
    expect(otra.stdout).toMatch(/YA ESTABA: 2/);
  });

  it('borrar: el ensayo no borra; con --aplicar quita solo lo que de verdad no es de esta base', async () => {
    const lista = join(dir, 'borrar.json');
    // Con un campus «falso» en el fichero: manda el que hay en la base.
    writeFileSync(lista, JSON.stringify({ avisos: [
      { matricula_id: base, centro: 'ZAJENA630' },
      { matricula_id: base + 2, centro: 'ZAJENA630' },
      { matricula_id: base + 9, centro: 'ZAJENA630' },
    ] }));
    const ensayo = correr('borrar', '--desde-fichero', lista);
    expect(ensayo.status, ensayo.stderr).toBe(0);
    expect(await fila(base)).toBeDefined();

    const r = correr('borrar', '--desde-fichero', lista, '--aplicar');
    expect(r.status, r.stderr).toBe(0);
    expect(await fila(base)).toBeUndefined();
    expect(await fila(base + 2)).toBeDefined();
    expect(r.stdout).toMatch(/YA NO ESTÁ: 1/);
  });

  it('en producción, --aplicar necesita RECUPERAR_EN_PRODUCCION=1', () => {
    const u = new URL(process.env.DATABASE_URL);
    u.pathname = '/crm_iseie';
    const r = spawnSync(process.execPath, [SCRIPT, 'meter', '--desde-fichero', join(dir, 'destino.json'), '--aplicar'], {
      env: entorno({ DATABASE_URL: u.toString(), RECUPERAR_EN_PRODUCCION: '' }), encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/PRODUCCIÓN/);
  });
});
