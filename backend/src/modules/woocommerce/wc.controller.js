import { z } from 'zod';
import * as model from './wc.model.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';

const credsSchema = z.object({
  project_id: z.number().int().positive(),
  store_url: z.string().url(),
  consumer_key: z.string().min(1),
  consumer_secret: z.string().optional(),
  active: z.boolean().optional(),
  auto_sync_enabled: z.boolean().optional(),
  sync_interval_minutes: z.number().int().min(5).max(1440).optional(),
});

function pid(req) { const p = parseInt(req.query.projectId); if (!p) throw new AppError('projectId requerido', 400, 'PROJECT_REQUIRED'); return p; }

export const getCreds = async (req, res, next) => {
  try {
    const c = await model.getCreds(pid(req));
    if (!c) return res.json({ success: true, data: null });
    res.json({ success: true, data: { ...c, consumer_secret: '****' } });
  } catch (e) { next(e); }
};
export const upsertCreds = async (req, res, next) => {
  try {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Datos invalidos', 400, 'VALIDATION_ERROR');
    const r = await model.upsertCreds(parsed.data.project_id, parsed.data);
    res.json({ success: true, data: { ...r, consumer_secret: '****' } });
  } catch (e) { next(e); }
};
export const deleteCreds = async (req, res, next) => {
  try { await model.deleteCreds(pid(req)); res.json({ success: true }); } catch (e) { next(e); }
};

export const listMappings = async (req, res, next) => {
  try { res.json({ success: true, data: await model.listMappings(pid(req)) }); } catch (e) { next(e); }
};
export const setMappings = async (req, res, next) => {
  try {
    const projectId = pid(req);
    const arr = req.body?.mappings;
    if (!Array.isArray(arr)) throw new AppError('mappings debe ser array', 400, 'VALIDATION_ERROR');
    res.json({ success: true, data: await model.setMappings(projectId, arr) });
  } catch (e) { next(e); }
};

export const listRuns = async (req, res, next) => {
  try { res.json({ success: true, data: await model.listRuns(pid(req)) }); } catch (e) { next(e); }
};

// ============================================================
// Helpers WC API con paginación y categorías
// ============================================================

const PER_PAGE = 100;
const MAX_PAGES = 50;  // hard limit de seguridad: 5000 productos máx por sync

function buildAuthQS(creds) {
  return `consumer_key=${encodeURIComponent(creds.consumer_key)}&consumer_secret=${encodeURIComponent(creds.consumer_secret)}`;
}

// Trae TODAS las páginas de un endpoint de WC
async function fetchAllPages(baseUrl, qs) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl}?per_page=${PER_PAGE}&page=${page}&${qs}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WC fetch ${res.status} en página ${page}: ${body.slice(0, 200)}`);
    }
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < PER_PAGE) break;  // última página
  }
  return all;
}

async function fetchWcProducts(creds) {
  const base = `${creds.store_url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
  return fetchAllPages(base, buildAuthQS(creds));
}

async function fetchWcCategories(creds) {
  const base = `${creds.store_url.replace(/\/$/, '')}/wp-json/wc/v3/products/categories`;
  return fetchAllPages(base, buildAuthQS(creds));
}

// Sincroniza categorías WC → product_categories. Devuelve map { wcId: localId }
async function syncCategories(projectId, wcCategories) {
  const wcMap = new Map();         // wcId → localId
  const byWcId = new Map(wcCategories.map(c => [c.id, c]));

  // Resolver en orden topológico: padres primero
  const resolved = new Set();
  const queue = [...wcCategories];
  let safety = 0;
  while (queue.length > 0 && safety++ < 1000) {
    const c = queue.shift();
    const parentWcId = c.parent || 0;
    if (parentWcId !== 0 && !resolved.has(parentWcId) && byWcId.has(parentWcId)) {
      queue.push(c);  // re-encolar, padre aún no procesado
      continue;
    }
    const parentLocalId = parentWcId === 0 ? null : (wcMap.get(parentWcId) || null);
    const localId = await model.upsertCategoryByWcId(projectId, c.id, c.name, parentLocalId);
    wcMap.set(c.id, localId);
    resolved.add(c.id);
  }
  return wcMap;
}

// Mapea producto WC → datos para insertar
function mapWcProduct(wp, categoryMap) {
  // Tipo de programa: meta `_cpt_sync_level` (cursos/masters/diplomados) si existe
  const levelMeta = (wp.meta_data || []).find(m => m.key === '_cpt_sync_level');
  const tipoPrograma = levelMeta?.value || null;

  // Categoría raíz y subcategoría (primera con parent != 0)
  const cats = wp.categories || [];
  let categoriaLocalId = null;
  let subcategoriaLocalId = null;
  for (const c of cats) {
    const localId = categoryMap.get(c.id);
    if (!localId) continue;
    if (categoriaLocalId === null) {
      categoriaLocalId = localId;
    } else {
      subcategoriaLocalId = localId;
      break;
    }
  }

  return {
    nombre: wp.name,
    precio: parseFloat(wp.price || wp.regular_price || 0),
    descripcion: wp.short_description || wp.description || null,
    sku: wp.sku || null,
    categoria_id: categoriaLocalId,
    subcategoria_id: subcategoriaLocalId,
    meta: {
      wc_status: wp.status,
      wc_type: wp.type,
      tipo_programa: tipoPrograma,
      categories_wc: cats.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
      variations: wp.variations,
      permalink: wp.permalink,
      slug: wp.slug,
    },
  };
}

export const importNow = async (req, res, next) => {
  try {
    const projectId = pid(req);
    const creds = await model.getCreds(projectId);
    if (!creds || !creds.active) throw new AppError('Credenciales WC no configuradas', 400, 'NO_CREDS');
    const run = await model.startRun(projectId, req.user.id);
    res.json({ success: true, data: { run_id: run.id, status: 'running' } });

    setImmediate(async () => {
      try {
        // 1. Sincronizar categorías primero
        logger.info({ projectId, runId: run.id }, 'WC: descargando categorías');
        const wcCategories = await fetchWcCategories(creds);
        const categoryMap = await syncCategories(projectId, wcCategories);
        logger.info({ projectId, count: wcCategories.length }, 'WC: categorías sincronizadas');

        // 2. Descargar todos los productos paginados
        logger.info({ projectId }, 'WC: descargando productos (paginado)');
        const wcProducts = await fetchWcProducts(creds);
        logger.info({ projectId, count: wcProducts.length }, 'WC: productos descargados');

        // 3. Upsert productos con categoría + sku
        let created = 0, updated = 0, skipped = 0;
        for (const wp of wcProducts) {
          if (!wp.name) { skipped++; continue; }
          const mapped = mapWcProduct(wp, categoryMap);
          const r = await model.upsertProductFromWc({ projectId, wcId: wp.id, data: mapped });
          if (r.action === 'created') created++;
          else if (r.action === 'updated') updated++;
        }
        await model.finishRun(run.id, {
          status: 'success',
          total_fetched: wcProducts.length,
          total_created: created,
          total_updated: updated,
          total_skipped: skipped,
        });
        logger.info({ projectId, created, updated, skipped, total: wcProducts.length }, 'WC import OK');
      } catch (err) {
        logger.error({ err: err.message, runId: run.id }, 'WC import error');
        await model.finishRun(run.id, { status: 'error', error_message: err.message?.slice(0, 1000) });
      }
    });
  } catch (e) { next(e); }
};

export const previewWc = async (req, res, next) => {
  try {
    const projectId = pid(req);
    const creds = await model.getCreds(projectId);
    if (!creds) throw new AppError('Credenciales WC no configuradas', 400, 'NO_CREDS');
    // Preview: solo primera página (rápido)
    const base = `${creds.store_url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const url = `${base}?per_page=3&${buildAuthQS(creds)}`;
    const r = await fetch(url);
    if (!r.ok) throw new AppError(`WC respondió ${r.status}`, 502, 'WC_ERROR');
    const sample = await r.json();

    // Total (header X-WP-Total)
    const totalUrl = `${base}?per_page=1&${buildAuthQS(creds)}`;
    const totalRes = await fetch(totalUrl);
    const total = parseInt(totalRes.headers.get('x-wp-total') || '0');

    res.json({ success: true, data: { count: total, sample } });
  } catch (e) { next(e); }
};
