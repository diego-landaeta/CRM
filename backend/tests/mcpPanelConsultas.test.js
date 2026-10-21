import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Conexión → MCP, «Consultas disponibles» (#335): cada consulta en su apartado y,
 * en el de Moodle, en qué campus hay un Moodle conectado. Con la base de verdad.
 *
 *   npx vitest run tests/mcpPanelConsultas.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { default: mcp } = await import('../src/modules/mcp/index.js');
const { errorHandler } = await import('../src/shared/middleware/errorHandler.js');
const { HERRAMIENTAS, GRUPO_DE_CONSULTA } = await import('../src/modules/mcp/mcp.tools.js');
const credenciales = await import('../src/modules/credentials/credentials.model.js');

const app = express();
app.use(express.json());
app.use(mcp.prefix, mcp.router);
app.use(errorHandler);
const request = supertest(app);

const MARCA = `MPC${Date.now().toString(36)}`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [], credenciales: [] };
let CON; let SIN; let ADMIN;

beforeAll(async () => {
  const proy = async (c) => {
    const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} ${c}`, `${MARCA.toLowerCase()}-${c}`, `${MARCA}-key-${c}`]);
    ids.projects.push(p.id);
    return p.id;
  };
  CON = await proy('con'); SIN = await proy('sin');
  const [u] = await q(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', 'admin') RETURNING id, role`,
    [`${MARCA} ADMIN`, `admin@${MARCA.toLowerCase()}.test`]);
  ADMIN = u; ids.users.push(u.id);
  for (const c of [CON, SIN]) await q(`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`, [u.id, c]);
  const cred = await credenciales.upsert({
    project_id: CON, service: 'moodle', entorno: 'produccion',
    value: JSON.stringify({ url: 'https://campus.ejemplo.test', token: `tok${MARCA}0123456789abcdef` }),
  });
  ids.credenciales.push(cred.id);
}, 60000);

afterAll(async () => {
  await q(`DELETE FROM api_credentials WHERE id = ANY($1::int[])`, [ids.credenciales]);
  await q(`DELETE FROM user_projects WHERE user_id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids.projects]);
  await pool.end();
}, 60000);

const panel = () => request.get('/api/mcp/panel')
  .set('Authorization', `Bearer ${jwt.sign({ userId: ADMIN.id, role: ADMIN.role }, process.env.JWT_SECRET, { expiresIn: '10m' })}`);

describe('cada consulta tiene su apartado', () => {
  it('ninguna cae en «Otras»: al añadir una consulta hay que decir dónde se enseña', () => {
    const sinGrupo = HERRAMIENTAS.map((h) => h.nombre).filter((n) => !GRUPO_DE_CONSULTA[n]);
    expect(sinGrupo).toEqual([]);
  });

  it('y el mapa no habla de consultas que ya no existen', () => {
    const nombres = new Set(HERRAMIENTAS.map((h) => h.nombre));
    expect(Object.keys(GRUPO_DE_CONSULTA).filter((n) => !nombres.has(n))).toEqual([]);
  });

  it('las cuatro de Moodle van juntas', () => {
    const moodle = HERRAMIENTAS.filter((h) => h.nombre.startsWith('moodle_')).map((h) => GRUPO_DE_CONSULTA[h.nombre]);
    expect(moodle).toHaveLength(4);
    expect(new Set(moodle)).toEqual(new Set(['Moodle de los campus']));
  });
});

describe('GET /api/mcp/panel', () => {
  it('cada herramienta trae su apartado', async () => {
    const r = await panel();
    expect(r.status).toBe(200);
    for (const h of r.body.data.herramientas) expect(h.grupo, h.nombre).toBeTruthy();
    expect(r.body.data.herramientas.find((h) => h.nombre === 'moodle_cursos').grupo).toBe('Moodle de los campus');
  });

  it('dice en qué campus hay Moodle conectado y en cuáles no', async () => {
    const r = await panel();
    const moodle = Object.fromEntries(r.body.data.moodle.map((c) => [c.id, c.configurado]));
    expect(moodle[CON]).toBe(true);
    expect(moodle[SIN]).toBe(false);
  });

  it('no enseña ni el token ni la dirección del Moodle', async () => {
    const texto = JSON.stringify((await panel()).body);
    expect(texto).not.toContain(`tok${MARCA}`);
    expect(texto).not.toContain('campus.ejemplo.test');
  });
});
