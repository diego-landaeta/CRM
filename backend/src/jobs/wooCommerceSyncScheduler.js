import { logger } from '../shared/utils/logger.js';
import { query } from '../shared/config/db.js';
import * as wcModel from '../modules/woocommerce/wc.model.js';

const TICK_MS = parseInt(process.env.WC_SYNC_TICK_MS || String(5 * 60 * 1000)); // 5 min default

let running = false;

async function fetchWcProducts({ store_url, consumer_key, consumer_secret }) {
  const url = `${store_url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=100&consumer_key=${encodeURIComponent(consumer_key)}&consumer_secret=${encodeURIComponent(consumer_secret)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WC fetch ${res.status}`);
  return await res.json();
}

async function syncProject(creds) {
  const minutesSinceLastSync = creds.last_sync_at ? (Date.now() - new Date(creds.last_sync_at).getTime()) / 60000 : Infinity;
  if (minutesSinceLastSync < (creds.sync_interval_minutes || 30)) return;

  let runId = null;
  try {
    const startRes = await wcModel.startRun(creds.project_id, null);
    runId = startRes.id;

    const wcProducts = await fetchWcProducts(creds);
    // Skip optimization: si el count es igual al ultimo conocido, asumir que no hay nuevos
    if (creds.last_wc_count != null && wcProducts.length === creds.last_wc_count) {
      await wcModel.finishRun(runId, { status: 'success', total_fetched: wcProducts.length, total_skipped: wcProducts.length });
      await query(`UPDATE wc_credentials SET last_sync_at = NOW() WHERE project_id = $1`, [creds.project_id]);
      return;
    }

    let created = 0, updated = 0;
    for (const wp of wcProducts) {
      if (!wp.name) continue;
      const meta = { wc_status: wp.status, sku: wp.sku, type: wp.type, categories: wp.categories?.map(c => c.name) };
      const r = await wcModel.upsertProductFromWc({
        projectId: creds.project_id, wcId: wp.id,
        data: { nombre: wp.name, precio: parseFloat(wp.price || 0), descripcion: wp.short_description || wp.description || null },
        meta,
      });
      if (r.action === 'created') created++;
      else if (r.action === 'updated') updated++;
    }
    await wcModel.finishRun(runId, { status: 'success', total_fetched: wcProducts.length, total_created: created, total_updated: updated });
    await query(`UPDATE wc_credentials SET last_sync_at = NOW(), last_wc_count = $2 WHERE project_id = $1`, [creds.project_id, wcProducts.length]);
    logger.info({ projectId: creds.project_id, created, updated }, 'WC auto-sync OK');
  } catch (err) {
    if (runId) await wcModel.finishRun(runId, { status: 'error', error_message: err.message?.slice(0, 1000) });
    logger.error({ err, projectId: creds.project_id }, 'WC auto-sync error');
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const { rows } = await query(`SELECT * FROM wc_credentials WHERE active = true AND auto_sync_enabled = true`);
    for (const c of rows) await syncProject(c);
  } catch (err) {
    logger.error({ err }, 'WC scheduler tick error');
  } finally { running = false; }
}

export function startWooCommerceSyncScheduler() {
  if (process.env.WC_SYNC_DISABLED === '1') {
    logger.warn('WooCommerce sync scheduler deshabilitado por WC_SYNC_DISABLED=1');
    return;
  }
  setInterval(tick, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'WooCommerce sync scheduler iniciado');
}
