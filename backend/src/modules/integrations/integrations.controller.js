import { z } from 'zod';
import * as model from './integrations.model.js';
import { encrypt, decrypt, maskSecret } from '../../shared/utils/crypto.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { urlDeStripe } from '../../shared/config/stripeApi.js';

/*
  SUPABASE, EL TERCERO (#44).

  Los proyectos IA guardan sus propios datos en Supabase --usuarios,
  suscripciones, consumo-- y de ahi se puede leer lo que la app sabe de cada
  cliente, que es mas de lo que dice Stripe.

  Se conecta con un ACCESS TOKEN de la Management API. Lo que NO sirve es
  sacar de ahi las claves de otros servicios: los secrets de un proyecto
  vuelven como SHA-256 de 64 caracteres, no como su valor. Comprobado contra
  Tarot IA: los 19, incluido `SUPABASE_URL`, que es publica. Queda escrito para
  que nadie lo intente otra vez.

  La referencia del proyecto (`project_ref`) va en `config_public`: no es
  secreta --sale en la URL de la propia app-- y hace falta en cada llamada.
*/
const SUPPORTED = ['stripe', 'brevo', 'supabase'];

// Sólo aceptamos los providers conocidos. Cada provider tiene su shape de
// config_public propia, pero validamos lo mínimo aquí (el detalle de cada
// campo lo enseñamos al usuario en la UI).
const upsertSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  provider: z.enum(SUPPORTED),
  active: z.boolean().optional(),
  api_key: z.string().min(8).max(500).optional().nullable(),  // si null/undefined, no se cambia
  // Secreto de firma del webhook (el whsec_... que da Stripe). Igual que la
  // api_key: si no viene, no se toca el que hubiera.
  webhook_secret: z.string().min(8).max(500).optional().nullable(),
  config_public: z.record(z.string(), z.any()).optional(),
});

function projectId(req) {
  const p = parseInt(req.query.projectId);
  if (isNaN(p) || p <= 0) throw new AppError('projectId requerido', 400, 'PROJECT_REQUIRED');
  return p;
}

// Toma la fila del DB y la prepara para serializar al frontend SIN exponer
// el secreto en claro. Devolvemos un secret_preview enmascarado para que el
// admin vea con qué key está configurado sin poder copiarla.
function sanitize(row) {
  if (!row) return null;
  let preview = null;
  if (row.encrypted_value && row.iv && row.auth_tag) {
    try {
      const plain = decrypt(row.encrypted_value, row.iv, row.auth_tag);
      preview = maskSecret(plain);
    } catch (err) {
      preview = '(no descifrable)';
      logger.warn({ provider: row.provider, project_id: row.project_id, err: err.message }, 'integrations: decrypt falló');
    }
  }
  return {
    id: row.id,
    project_id: row.project_id,
    provider: row.provider,
    active: row.active,
    has_secret: !!row.encrypted_value,
    secret_preview: preview,
    config_public: row.config_public || {},
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    last_test_at: row.last_test_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/integrations?projectId=N
export async function list(req, res, next) {
  try {
    const rows = await model.listByProject(projectId(req));
    // listByProject NO trae los campos crypto, así que no hay que descifrar
    res.json({ success: true, data: rows.map((r) => ({
      ...r,
      secret_preview: null,  // sólo el GET de detalle por provider devuelve preview
    })) });
  } catch (err) { next(err); }
}

// GET /api/integrations/:provider?projectId=N
export async function getOne(req, res, next) {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SUPPORTED.includes(provider)) throw new AppError('Provider no soportado', 400, 'BAD_PROVIDER');
    const row = await model.get(projectId(req), provider);
    res.json({ success: true, data: sanitize(row) });
  } catch (err) { next(err); }
}

// PUT /api/integrations
export async function upsert(req, res, next) {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const { projectId: pid, provider, active, api_key, webhook_secret, config_public } = parsed.data;
    let encryptedFields = {};
    if (api_key && api_key.trim()) {
      const enc = encrypt(api_key.trim());
      encryptedFields = { encrypted_value: enc.encrypted, iv: enc.iv, auth_tag: enc.authTag };
    }

    // El secreto del webhook va cifrado DENTRO de config_public, con su propio
    // iv y su etiqueta: las columnas iv/auth_tag de la fila son de la api_key y
    // reutilizarlas romperia una de las dos.
    //
    // Y se parte de la config guardada, no de la que manda el navegador: si no,
    // guardar cualquier otra cosa borraria el secreto sin que nadie se entere.
    const anterior = await model.get(pid, provider);
    let config = { ...(anterior?.config_public || {}), ...(config_public || {}) };
    if (webhook_secret && webhook_secret.trim()) {
      const w = encrypt(webhook_secret.trim());
      config = {
        ...config,
        webhook_secret_encrypted: w.encrypted,
        webhook_secret_iv: w.iv,
        webhook_secret_auth_tag: w.authTag,
        webhook_secret_preview: maskSecret(webhook_secret.trim()),
      };
      delete config.webhook_secret;  // nunca dejarlo en claro
    }

    const row = await model.upsert({ projectId: pid, provider, active, config_public: config, ...encryptedFields });
    res.json({ success: true, data: sanitize(row) });
  } catch (err) { next(err); }
}

// POST /api/integrations/:provider/test?projectId=N
// Prueba la conexión con el provider haciendo una llamada autenticada read-only.
// Stripe: GET /v1/balance — devuelve 401 si la key es mala, 200 si es buena.
// Brevo:  GET /v3/account — igual lógica.
export async function test(req, res, next) {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SUPPORTED.includes(provider)) throw new AppError('Provider no soportado', 400, 'BAD_PROVIDER');
    const pid = projectId(req);
    const row = await model.get(pid, provider);
    if (!row || !row.encrypted_value) {
      const msg = 'No hay credencial guardada para este provider';
      await model.recordTestResult({ projectId: pid, provider, status: 'error', message: msg });
      return res.status(400).json({ success: false, error: msg, code: 'NO_CREDENTIAL' });
    }
    let apiKey;
    try {
      apiKey = decrypt(row.encrypted_value, row.iv, row.auth_tag);
    } catch (e) {
      await model.recordTestResult({ projectId: pid, provider, status: 'error', message: 'Credencial no descifrable' });
      throw new AppError('Credencial no descifrable (posible cambio de ENCRYPTION_KEY)', 500, 'DECRYPT_FAILED');
    }

    let testResult;
    try {
      if (provider === 'stripe') testResult = await testStripe(apiKey);
      else if (provider === 'brevo') testResult = await testBrevo(apiKey);
      else if (provider === 'supabase') testResult = await testSupabase(apiKey, row.config_public?.project_ref);
    } catch (e) {
      testResult = { ok: false, message: e.message };
    }
    await model.recordTestResult({
      projectId: pid, provider,
      status: testResult.ok ? 'success' : 'error',
      message: testResult.message,
    });
    res.json({ success: testResult.ok, data: testResult });
  } catch (err) { next(err); }
}

// DELETE /api/integrations/:provider?projectId=N
export async function remove(req, res, next) {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SUPPORTED.includes(provider)) throw new AppError('Provider no soportado', 400, 'BAD_PROVIDER');
    await model.remove(projectId(req), provider);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Test helpers ────────────────────────────────────────────────────────

async function testStripe(apiKey) {
  // /v1/balance es read-only y siempre disponible. Devuelve 401 si la key es mala.
  const r = await fetch(urlDeStripe('/v1/balance'), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (r.ok) {
    const data = await r.json().catch(() => null);
    const livemode = data?.livemode === true;
    return {
      ok: true,
      message: `Conexión OK. Modo: ${livemode ? 'LIVE (producción)' : 'TEST (sandbox)'}.`,
      livemode,
    };
  }
  if (r.status === 401) return { ok: false, message: 'API key inválida (401 Unauthorized)' };
  return { ok: false, message: `Stripe HTTP ${r.status}` };
}

/**
 * Probar el access token de Supabase.
 *
 * Se pide la lista de proyectos, que es la llamada mas inocua que hay, y se
 * comprueba ademas que el `project_ref` guardado esta entre los que el token
 * alcanza. Un token valido de OTRA cuenta daria 200 y no serviria de nada: sin
 * esa segunda comprobacion la pantalla diria «conectado» y no traeria un dato.
 */
async function testSupabase(accessToken, projectRef) {
  const r = await fetch('https://api.supabase.com/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 401) return { ok: false, message: 'Access token invalido (401 Unauthorized)' };
  if (!r.ok) return { ok: false, message: `Supabase HTTP ${r.status}` };
  const proyectos = await r.json().catch(() => []);
  if (!projectRef) {
    return { ok: false, message: `Token valido (${proyectos.length} proyectos), pero falta la referencia del proyecto.` };
  }
  const suyo = proyectos.find((x) => x.id === projectRef);
  if (!suyo) {
    return {
      ok: false,
      message: `El token no alcanza el proyecto ${projectRef}. Alcanza: ${proyectos.map((x) => x.name).join(', ') || 'ninguno'}.`,
    };
  }
  return { ok: true, message: `Conexion OK con «${suyo.name}» (${suyo.region}).`, projectRef };
}

async function testBrevo(apiKey) {
  // /v3/account es read-only. Devuelve 401 si la key es mala.
  const r = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': apiKey, Accept: 'application/json' },
  });
  if (r.ok) {
    const data = await r.json().catch(() => null);
    const email = data?.email || '?';
    return { ok: true, message: `Conexión OK con cuenta ${email}.`, email };
  }
  if (r.status === 401) return { ok: false, message: 'API key inválida (401 Unauthorized)' };
  return { ok: false, message: `Brevo HTTP ${r.status}` };
}
