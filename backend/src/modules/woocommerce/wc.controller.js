import { z } from 'zod';
import * as model from './wc.model.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';

const credsSchema = z.object({
  project_id: z.number().int().positive(),
  store_url: z.string().url(),
  consumer_key: z.string().min(1),
  consumer_secret: z.string().optional(),  // empty = mantener
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

async function fetchWcProducts({ store_url, consumer_key, consumer_secret }) {
  const url = `${store_url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=100&consumer_key=${encodeURIComponent(consumer_key)}&consumer_secret=${encodeURIComponent(consumer_secret)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WC fetch ${res.status}`);
  return await res.json();
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
        const wcProducts = await fetchWcProducts(creds);
        let created = 0, updated = 0, skipped = 0;
        for (const wp of wcProducts) {
          if (!wp.name) { skipped++; continue; }
          const meta = { wc_status: wp.status, sku: wp.sku, type: wp.type, categories: wp.categories?.map(c => c.name), variations: wp.variations };
          const r = await model.upsertProductFromWc({
            projectId, wcId: wp.id,
            data: { nombre: wp.name, precio: parseFloat(wp.price || 0), descripcion: wp.short_description || wp.description || null },
            meta,
          });
          if (r.action === 'created') created++;
          else if (r.action === 'updated') updated++;
        }
        await model.finishRun(run.id, { status: 'success', total_fetched: wcProducts.length, total_created: created, total_updated: updated, total_skipped: skipped });
      } catch (err) {
        logger.error({ err, runId: run.id }, 'WC import error');
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
    const wp = await fetchWcProducts(creds);
    const sample = wp.slice(0, 3);
    res.json({ success: true, data: { count: wp.length, sample } });
  } catch (e) { next(e); }
};
