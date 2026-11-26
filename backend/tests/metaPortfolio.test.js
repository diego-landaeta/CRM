import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

/**
 * Conectar un portfolio de Meta entero (#212): en vez de dar de alta cada
 * cuenta publicitaria a mano, se conecta el Business Manager y las cuentas
 * nuevas que aparezcan dentro se descubren solas, en una bandeja.
 *
 * Meta está DOBLADO: ni una llamada real a la Graph API. La base es la local
 * desechable.
 *
 *   docker compose -f docker-compose.dev.yml up -d && npm run db:preparar
 *   npx vitest run tests/metaPortfolio.test.js
 */

const N = String(Date.now());
const MARCA = `MP${N.slice(-6)}`;
const BIZ = `biz${N}`;
const TOKEN = 'token-de-pruebas-que-no-va-a-meta';

const EXISTING_ID = `${N}1`; // ya conectada a mano antes de existir el portfolio
const NEW_ID = `${N}2`;      // se descubre y se asigna sin problema
const RETRY_ID = `${N}3`;    // sin acceso directo, pero el reintento funciona
const FAIL_ID = `${N}4`;     // nunca hay acceso, ni con el reintento

const CUENTAS_META = {
  [BIZ]: [
    { account_id: EXISTING_ID, name: `${MARCA} Ya conectada`, currency: 'EUR', timezone_name: 'Europe/Madrid' },
    { account_id: NEW_ID, name: `${MARCA} Campus Extra`, currency: 'EUR', timezone_name: 'Europe/Madrid' },
    { account_id: RETRY_ID, name: `${MARCA} Retry`, currency: 'EUR', timezone_name: 'Europe/Madrid' },
    { account_id: FAIL_ID, name: `${MARCA} Fail`, currency: 'EUR', timezone_name: 'Europe/Madrid' },
  ],
};

// Cuántas veces se llamó a validateConnection por cuenta, para que RETRY_ID
// falle la primera vez y funcione la segunda (tras el "dar acceso").
const validateCalls = {};

vi.mock('../src/modules/meta-ads/meta-ads.client.js', () => ({
  validateConnection: vi.fn(async ({ adAccountId }) => {
    validateCalls[adAccountId] = (validateCalls[adAccountId] || 0) + 1;
    if (adAccountId === `act_${FAIL_ID}`) throw new Error('(#10) Sin permiso sobre esta cuenta');
    if (adAccountId === `act_${RETRY_ID}` && validateCalls[adAccountId] === 1) throw new Error('(#10) Sin permiso sobre esta cuenta');
    return { id: adAccountId, nombre: 'Cuenta validada', currency: 'EUR', timezone_name: 'Europe/Madrid' };
  }),
  listOwnedAdAccounts: vi.fn(async ({ businessId }) => CUENTAS_META[businessId] || []),
  getTokenOwnerId: vi.fn(async () => ({ id: 'owner-test', nombre: 'Owner Test' })),
  grantAnalystAccess: vi.fn(async () => ({ success: true })),
}));

const avisos = [];
vi.mock('../src/modules/notifications/notifications.service.js', async (orig) => ({
  ...(await orig()),
  notifyAdmins: vi.fn(async (a) => { avisos.push(a); return { id: 1 }; }),
}));

const { default: pool } = await import('../src/shared/config/db.js');
const { encrypt } = await import('../src/shared/utils/crypto.js');
const service = await import('../src/modules/meta-ads/meta-portfolio.service.js');
const client = await import('../src/modules/meta-ads/meta-ads.client.js');

const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [] };
let P; let ADMIN; let PORTFOLIO_ID;

beforeAll(async () => {
  const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
    [`${MARCA} Campus`, `${MARCA.toLowerCase()}-campus`, `${MARCA}-key`]);
  P = p.id; ids.projects.push(P);

  const [u] = await q(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', 'admin') RETURNING id, role, nombre`,
    [`${MARCA} ADMIN`, `admin@${MARCA.toLowerCase()}.test`]);
  ADMIN = u; ids.users.push(u.id);

  // Ya estaba conectada a mano antes de que existiera el portfolio: al
  // sincronizar, el portfolio debe reconocerla como 'asignada', no duplicarla.
  const token = (() => { const { encrypted, iv, authTag } = encrypt(TOKEN); return `${iv}:${authTag}:${encrypted}`; })();
  await q(
    `INSERT INTO meta_ad_accounts (project_id, ad_account_id, access_token_enc, ad_account_nombre, currency, backfill_done)
     VALUES ($1, $2, $3, 'Ya conectada a mano', 'EUR', true)`,
    [P, `act_${EXISTING_ID}`, token]
  );
}, 60000);

afterAll(async () => {
  await q(`DELETE FROM meta_portfolio_discovered_accounts WHERE portfolio_id = $1`, [PORTFOLIO_ID]);
  await q(`DELETE FROM meta_business_portfolios WHERE business_id = $1`, [BIZ]);
  await q(`DELETE FROM meta_ad_accounts WHERE project_id = ANY($1::int[])`, [ids.projects]);
  await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids.projects]);
  await pool.end();
}, 60000);

describe('conectar un portfolio (#212)', () => {
  it('valida contra Meta antes de guardar, y el token queda cifrado', async () => {
    const r = await service.connectPortfolio({ businessId: BIZ, nombre: 'Negocio de prueba', accessToken: TOKEN, userId: ADMIN.id });
    PORTFOLIO_ID = r.id;
    expect(r.business_id).toBe(BIZ);
    expect(client.listOwnedAdAccounts).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, accessToken: TOKEN, limit: 1 }));

    const [row] = await q(`SELECT access_token_enc FROM meta_business_portfolios WHERE id = $1`, [PORTFOLIO_ID]);
    expect(row.access_token_enc).not.toContain(TOKEN);
  });

  it('reconectar el mismo business_id actualiza, no duplica', async () => {
    await service.connectPortfolio({ businessId: BIZ, nombre: 'Nombre actualizado', accessToken: TOKEN, userId: ADMIN.id });
    const filas = await q(`SELECT id, nombre FROM meta_business_portfolios WHERE business_id = $1`, [BIZ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].nombre).toBe('Nombre actualizado');
  });

  it('listPortfolios nunca devuelve el token', async () => {
    const rows = await service.listPortfolios();
    const mio = rows.find((r) => r.id === PORTFOLIO_ID);
    expect(mio).toBeDefined();
    expect(JSON.stringify(mio)).not.toMatch(/token|access_token_enc/i);
  });
});

describe('sincronizar: descubre, sugiere campus, no duplica ni avisa de más (#212)', () => {
  it('la ya conectada entra como asignada (sin aviso); las demás, nuevas con campus sugerido', async () => {
    const r = await service.syncPortfolio(PORTFOLIO_ID);
    expect(r.cuentasVistas).toBe(4);
    expect(r.nuevas).toBe(3); // todas menos la ya conectada
    expect(avisos).toHaveLength(1);
    expect(avisos[0].type).toBe('meta_portfolio_cuenta_nueva');

    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    expect(filas).toHaveLength(4);

    const existente = filas.find((f) => f.ad_account_id === `act_${EXISTING_ID}`);
    expect(existente.estado).toBe('asignada');
    expect(existente.meta_ad_account_id).not.toBeNull();

    const nueva = filas.find((f) => f.ad_account_id === `act_${NEW_ID}`);
    expect(nueva.estado).toBe('nueva');
    expect(nueva.campus_sugerido_nombre).toBe(`${MARCA} Campus`);
  });

  it('volver a sincronizar no duplica filas ni vuelve a avisar de las que ya estaban', async () => {
    avisos.length = 0;
    const r = await service.syncPortfolio(PORTFOLIO_ID);
    expect(r.cuentasVistas).toBe(4);
    expect(r.nuevas).toBe(0);
    expect(avisos).toHaveLength(0);
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    expect(filas).toHaveLength(4);
  });
});

describe('asignar una cuenta descubierta (#212)', () => {
  it('conecta de verdad en meta_ad_accounts, con backfill_done en false (el scheduler de siempre le trae el histórico)', async () => {
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const nueva = filas.find((f) => f.ad_account_id === `act_${NEW_ID}`);
    const r = await service.assignDiscoveredAccount(nueva.id, { projectId: P, userId: ADMIN.id });
    expect(r.metaAdAccountId).toBeDefined();

    const [cuenta] = await q(`SELECT project_id, backfill_done FROM meta_ad_accounts WHERE id = $1`, [r.metaAdAccountId]);
    expect(cuenta.project_id).toBe(P);
    expect(cuenta.backfill_done).toBe(false);

    const [fila] = await q(`SELECT estado, meta_ad_account_id FROM meta_portfolio_discovered_accounts WHERE id = $1`, [nueva.id]);
    expect(fila.estado).toBe('asignada');
    expect(fila.meta_ad_account_id).toBe(r.metaAdAccountId);
  });

  it('una ya asignada no se puede volver a asignar', async () => {
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const existente = filas.find((f) => f.ad_account_id === `act_${EXISTING_ID}`);
    await expect(service.assignDiscoveredAccount(existente.id, { projectId: P, userId: ADMIN.id }))
      .rejects.toMatchObject({ code: 'YA_ASIGNADA' });
  });

  it('sin acceso directo: da acceso al dueño del token y reintenta antes de rendirse', async () => {
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const retry = filas.find((f) => f.ad_account_id === `act_${RETRY_ID}`);
    const r = await service.assignDiscoveredAccount(retry.id, { projectId: P, userId: ADMIN.id });
    expect(client.getTokenOwnerId).toHaveBeenCalled();
    expect(client.grantAnalystAccess).toHaveBeenCalledWith(expect.objectContaining({ adAccountId: `act_${RETRY_ID}` }));
    expect(r.metaAdAccountId).toBeDefined();
  });

  it('si ni con el reintento hay acceso, queda "sin_acceso" (no se pierde, no se repite sola)', async () => {
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const fail = filas.find((f) => f.ad_account_id === `act_${FAIL_ID}`);
    await expect(service.assignDiscoveredAccount(fail.id, { projectId: P, userId: ADMIN.id }))
      .rejects.toMatchObject({ code: 'SIN_ACCESO' });
    const [fila] = await q(`SELECT estado FROM meta_portfolio_discovered_accounts WHERE id = $1`, [fail.id]);
    expect(fila.estado).toBe('sin_acceso');
  });
});

describe('ignorar es definitivo (#212)', () => {
  it('ignora una sin_acceso; una ya asignada no se puede ignorar', async () => {
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const fail = filas.find((f) => f.ad_account_id === `act_${FAIL_ID}`);
    await service.ignoreDiscoveredAccount(fail.id);
    const [fila] = await q(`SELECT estado FROM meta_portfolio_discovered_accounts WHERE id = $1`, [fail.id]);
    expect(fila.estado).toBe('ignorada');

    const asignada = filas.find((f) => f.ad_account_id === `act_${NEW_ID}`);
    await expect(service.ignoreDiscoveredAccount(asignada.id)).rejects.toMatchObject({ code: 'NO_SE_PUEDE_IGNORAR' });
  });

  it('una ignorada no cambia en una nueva sincronización, aunque Meta la siga listando', async () => {
    avisos.length = 0;
    await service.syncPortfolio(PORTFOLIO_ID);
    const filas = await service.listDiscoveredAccounts(PORTFOLIO_ID);
    const fail = filas.find((f) => f.ad_account_id === `act_${FAIL_ID}`);
    expect(fail.estado).toBe('ignorada');
    expect(avisos).toHaveLength(0);
  });
});

describe('desconectar (#212)', () => {
  it('borra el portfolio sin tocar las cuentas ya asignadas', async () => {
    await service.disconnectPortfolio(PORTFOLIO_ID);
    const rows = await q(`SELECT id FROM meta_business_portfolios WHERE id = $1`, [PORTFOLIO_ID]);
    expect(rows).toHaveLength(0);
    const cuentas = await q(`SELECT id FROM meta_ad_accounts WHERE project_id = $1`, [P]);
    expect(cuentas.length).toBeGreaterThan(0);
  });
});


describe('acceso por HTTP: quien puede tocar el portfolio (#212, revision Diego)', () => {
  const idsHttp = { users: [], projects: [] };
  let P1, P2, AD1, AD2, GESTOR, SOPORTE, SA, PORTFOLIO_HTTP, DISCOVERED_ID;
  const como = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' })}` });

  beforeAll(async () => {
    const [p1] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} HTTP P1`, `${MARCA.toLowerCase()}-http-p1`, `${MARCA}-http-p1-key`]);
    P1 = p1.id; idsHttp.projects.push(P1);
    const [p2] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} HTTP P2`, `${MARCA.toLowerCase()}-http-p2`, `${MARCA}-http-p2-key`]);
    P2 = p2.id; idsHttp.projects.push(P2);

    const crear = async (nombre, email, role) => {
      const [u] = await q(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role`,
        [nombre, email, role]);
      idsHttp.users.push(u.id);
      return u;
    };
    AD1 = await crear(`${MARCA} AD1`, `ad1@${MARCA.toLowerCase()}.test`, 'admin');
    AD2 = await crear(`${MARCA} AD2`, `ad2@${MARCA.toLowerCase()}.test`, 'admin');
    GESTOR = await crear(`${MARCA} GESTOR`, `gestor@${MARCA.toLowerCase()}.test`, 'gestor');
    SOPORTE = await crear(`${MARCA} SOPORTE`, `soporte@${MARCA.toLowerCase()}.test`, 'soporte');
    SA = await crear(`${MARCA} SA`, `sa@${MARCA.toLowerCase()}.test`, 'superadmin');

    await q(`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`, [AD1.id, P1]);
    await q(`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`, [AD2.id, P2]);

    const tokenCifrado = (() => { const { encrypted, iv, authTag } = encrypt('token-http-test'); return `${iv}:${authTag}:${encrypted}`; })();
    const [portfolio] = await q(
      `INSERT INTO meta_business_portfolios (business_id, nombre, access_token_enc, created_by_user_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`${BIZ}-http`, 'Portfolio HTTP test', tokenCifrado, SA.id]);
    PORTFOLIO_HTTP = portfolio.id;

    const [discovered] = await q(
      `INSERT INTO meta_portfolio_discovered_accounts (portfolio_id, ad_account_id, nombre, estado, campus_sugerido_id)
       VALUES ($1, $2, $3, 'nueva', $4) RETURNING id`,
      [PORTFOLIO_HTTP, `act_${N}http`, 'Cuenta HTTP test', P1]);
    DISCOVERED_ID = discovered.id;
  }, 60000);

  afterAll(async () => {
    await q(`DELETE FROM meta_portfolio_discovered_accounts WHERE portfolio_id = $1`, [PORTFOLIO_HTTP]);
    await q(`DELETE FROM meta_business_portfolios WHERE id = $1`, [PORTFOLIO_HTTP]);
    await q(`DELETE FROM meta_ad_accounts WHERE project_id = ANY($1::int[])`, [idsHttp.projects]);
    await q(`DELETE FROM user_projects WHERE user_id = ANY($1::int[])`, [idsHttp.users]);
    await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [idsHttp.users]);
    await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [idsHttp.projects]);
  }, 60000);

  it('soporte no puede conectar un portfolio (no tiene el permiso, a proposito)', async () => {
    const res = await request(app).post('/api/meta-ads/portfolios').set(como(SOPORTE))
      .send({ business_id: '999999', access_token: 'x'.repeat(25) });
    expect(res.status).toBe(403);
  });

  it('gestor no puede conectar un portfolio', async () => {
    const res = await request(app).post('/api/meta-ads/portfolios').set(como(GESTOR))
      .send({ business_id: '999999', access_token: 'x'.repeat(25) });
    expect(res.status).toBe(403);
  });

  it('un admin de campus (no ve todo el CRM) no puede listar portfolios: es del negocio entero', async () => {
    const res = await request(app).get('/api/meta-ads/portfolios').set(como(AD1));
    expect(res.status).toBe(403);
  });

  it('superadmin si puede listar, y el token nunca sale en la respuesta', async () => {
    const res = await request(app).get('/api/meta-ads/portfolios').set(como(SA));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/token-http-test|access_token_enc/i);
  });

  it('un admin de otro campus no puede asignar la cuenta descubierta a un campus que no es suyo', async () => {
    const res = await request(app)
      .post(`/api/meta-ads/portfolios/discovered/${DISCOVERED_ID}/assign`)
      .set(como(AD2))
      .send({ project_id: P1 });
    expect(res.status).toBe(403);
  });

  it('project_id invalido ("5abc") no cuela como 5: 400, no 200', async () => {
    const res = await request(app)
      .post(`/api/meta-ads/portfolios/discovered/${DISCOVERED_ID}/assign`)
      .set(como(AD1))
      .send({ project_id: '5abc' });
    expect(res.status).toBe(400);
  });
});