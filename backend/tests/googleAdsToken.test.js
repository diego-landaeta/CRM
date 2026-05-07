import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshGoogleAdsAccessToken } from '../src/shared/services/googleAds.service.js';

const ARGS = { clientId: 'cid', clientSecret: 'csec', refreshToken: 'rtok' };

describe('refreshGoogleAdsAccessToken', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('devuelve {ok:false, code:missing_oauth_config} si faltan client_id o client_secret', async () => {
    const r = await refreshGoogleAdsAccessToken({ clientId: '', clientSecret: '', refreshToken: 'rtok' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_oauth_config');
  });

  it('devuelve {ok:false, code:missing_refresh_token} si falta refresh_token', async () => {
    const r = await refreshGoogleAdsAccessToken({ clientId: 'cid', clientSecret: 'csec', refreshToken: '' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_refresh_token');
  });

  it('devuelve {ok:true} cuando Google responde 200 con access_token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'AT', expires_in: 3600 }),
    });
    const r = await refreshGoogleAdsAccessToken(ARGS);
    expect(r.ok).toBe(true);
    expect(r.accessToken).toBe('AT');
    expect(r.expiresIn).toBe(3600);
  });

  it('propaga el error code de Google cuando el refresh_token fue revocado', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
    });
    const r = await refreshGoogleAdsAccessToken(ARGS);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid_grant');
    expect(r.message).toContain('expired or revoked');
  });

  it('devuelve {ok:false, code:network_error} si fetch lanza', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const r = await refreshGoogleAdsAccessToken(ARGS);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('network_error');
    expect(r.message).toBe('ECONNRESET');
  });

  it('devuelve {ok:false, code:no_access_token} si Google responde 200 pero sin access_token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const r = await refreshGoogleAdsAccessToken(ARGS);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('no_access_token');
  });

  it('devuelve code http_<status> cuando Google no devuelve campo error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    const r = await refreshGoogleAdsAccessToken(ARGS);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('http_503');
  });
});
