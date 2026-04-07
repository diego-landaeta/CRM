import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import app from '../src/app.js';
import pool from '../src/shared/config/db.js';

const request = supertest(app);

// Usuario de test
const TEST_USER = {
  nombre: 'Test Auth User',
  email: 'test-auth@crm-test.com',
  password: 'TestPass2026!',
  role: 'admin',
};

let testUserId;

beforeAll(async () => {
  // Limpiar datos de test previos
  await pool.query(`DELETE FROM user_refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [TEST_USER.email]);
  await pool.query(`DELETE FROM user_activity_log WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [TEST_USER.email]);
  await pool.query(`DELETE FROM user_projects WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [TEST_USER.email]);
  await pool.query(`DELETE FROM users WHERE email = $1`, [TEST_USER.email]);

  // Crear usuario de test
  const hash = await bcrypt.hash(TEST_USER.password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [TEST_USER.nombre, TEST_USER.email, hash, TEST_USER.role]
  );
  testUserId = rows[0].id;

  // Asignar a proyecto 1 (Psiko Aprende)
  await pool.query(
    `INSERT INTO user_projects (user_id, project_id, orden_cola) VALUES ($1, 1, 1)`,
    [testUserId]
  );
});

afterAll(async () => {
  // Limpiar
  await pool.query(`DELETE FROM user_refresh_tokens WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM user_activity_log WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM user_projects WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
  await pool.end();
});

// ============================================================
// POST /api/auth/login
// ============================================================

describe('POST /api/auth/login', () => {
  it('login exitoso con credenciales validas', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.role).toBe(TEST_USER.role);
    expect(res.body.data.projects).toBeInstanceOf(Array);
    expect(res.body.data.projects.length).toBeGreaterThan(0);
    expect(res.body.data.activeProjectId).toBeDefined();

    // Refresh token en cookie httpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);

    // No expone password_hash
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('falla con email incorrecto', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: TEST_USER.password });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('falla con password incorrecto', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('falla sin email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ password: TEST_USER.password });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('falla sin password', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
  });

  it('falla con usuario desactivado', async () => {
    // Desactivar usuario
    await pool.query(`UPDATE users SET active = false WHERE id = $1`, [testUserId]);

    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');

    // Reactivar
    await pool.query(`UPDATE users SET active = true WHERE id = $1`, [testUserId]);
  });

  it('registra actividad de login', async () => {
    await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const { rows } = await pool.query(
      `SELECT action FROM user_activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [testUserId]
    );
    expect(rows[0].action).toBe('login');
  });

  it('actualiza last_login_at', async () => {
    const before = await pool.query(`SELECT last_login_at FROM users WHERE id = $1`, [testUserId]);

    await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const after = await pool.query(`SELECT last_login_at FROM users WHERE id = $1`, [testUserId]);
    expect(new Date(after.rows[0].last_login_at).getTime())
      .toBeGreaterThanOrEqual(new Date(before.rows[0].last_login_at || 0).getTime());
  });

  it('normaliza email a lowercase', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email.toUpperCase(), password: TEST_USER.password });

    expect(res.status).toBe(200);
  });
});

// ============================================================
// POST /api/auth/refresh
// ============================================================

describe('POST /api/auth/refresh', () => {
  let refreshCookie;

  beforeEach(async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    refreshCookie = res.headers['set-cookie']
      .find((c) => c.startsWith('refreshToken='));
  });

  it('genera nuevo accessToken con refresh cookie valido', async () => {
    const res = await request
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    // Cookie rotada
    const newCookies = res.headers['set-cookie'];
    expect(newCookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('el refresh token viejo no funciona despues de rotacion', async () => {
    // Primer refresh (rota el token)
    await request
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    // Segundo refresh con el token viejo
    const res = await request
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_INVALID');
  });

  it('falla sin cookie', async () => {
    const res = await request.post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_REQUIRED');
  });
});

// ============================================================
// POST /api/auth/logout
// ============================================================

describe('POST /api/auth/logout', () => {
  it('logout exitoso revoca token y limpia cookie', async () => {
    // Login primero
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const accessToken = loginRes.body.data.accessToken;
    const refreshCookie = loginRes.headers['set-cookie']
      .find((c) => c.startsWith('refreshToken='));

    // Logout
    const res = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Sesion cerrada');

    // Refresh con el token revocado falla
    const refreshRes = await request
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshRes.status).toBe(401);
  });

  it('falla sin accessToken', async () => {
    const res = await request.post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  it('registra actividad de logout', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const accessToken = loginRes.body.data.accessToken;
    const refreshCookie = loginRes.headers['set-cookie']
      .find((c) => c.startsWith('refreshToken='));

    await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie);

    const { rows } = await pool.query(
      `SELECT action FROM user_activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [testUserId]
    );
    expect(rows[0].action).toBe('logout');
  });
});

// ============================================================
// POST /api/auth/set-password
// ============================================================

describe('POST /api/auth/set-password', () => {
  const rawToken = 'test-set-password-token-2026';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  beforeEach(async () => {
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    await pool.query(
      `UPDATE users SET set_password_token = $1, set_password_expires = $2 WHERE id = $3`,
      [tokenHash, expires, testUserId]
    );
  });

  it('establece password con token valido', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'NuevaPass2026!', confirmPassword: 'NuevaPass2026!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Puede hacer login con el nuevo password
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'NuevaPass2026!' });

    expect(loginRes.status).toBe(200);

    // Restaurar password original
    const hash = await bcrypt.hash(TEST_USER.password, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, testUserId]);
  });

  it('falla con token invalido', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: 'token-invalido', password: 'NuevaPass2026!', confirmPassword: 'NuevaPass2026!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('falla con token expirado', async () => {
    const expired = new Date();
    expired.setHours(expired.getHours() - 25);
    await pool.query(
      `UPDATE users SET set_password_expires = $1 WHERE id = $2`,
      [expired, testUserId]
    );

    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'NuevaPass2026!', confirmPassword: 'NuevaPass2026!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('falla si passwords no coinciden', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'NuevaPass2026!', confirmPassword: 'OtraPass2026!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('falla con password debil (sin mayuscula)', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'nouppcase1', confirmPassword: 'nouppcase1' });

    expect(res.status).toBe(400);
  });

  it('falla con password debil (sin numero)', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'NoNumberHere', confirmPassword: 'NoNumberHere' });

    expect(res.status).toBe(400);
  });

  it('falla con password corto (<8)', async () => {
    const res = await request
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'Ab1!', confirmPassword: 'Ab1!' });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// GET /api/auth/me
// ============================================================

describe('GET /api/auth/me', () => {
  it('retorna datos del usuario autenticado', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const accessToken = loginRes.body.data.accessToken;

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.role).toBe(TEST_USER.role);
    expect(res.body.data.projects).toBeInstanceOf(Array);
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('falla sin token', async () => {
    const res = await request.get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('falla con token invalido', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-falso-12345');

    expect(res.status).toBe(401);
  });
});

// ============================================================
// GET /api/health
// ============================================================

describe('GET /api/health', () => {
  it('retorna status ok', async () => {
    const res = await request.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});
