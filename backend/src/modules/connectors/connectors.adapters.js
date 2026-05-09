// Adaptadores por tipo de conector. Cada adaptador sabe:
//   - fetchSample(config)  → trae 1-3 items de muestra (para mapping visual)
//   - fetchAll(config)     → trae TODOS los items (con paginación)
// El mapping field_mapping y la importación al CRM se hace en el service.

import { logger } from '../../shared/utils/logger.js';

// Helper: resuelve "a.b.c" sobre obj
export function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    // Soportar arrays con notación [N]
    const m = key.match(/^([^[]+)(?:\[(\d+)\])?$/);
    if (!m) return undefined;
    let val = acc[m[1]];
    if (m[2] !== undefined && Array.isArray(val)) val = val[parseInt(m[2])];
    return val;
  }, obj);
}

// Adaptador WooCommerce — products o orders
async function wcRequest(config, endpoint, params = {}) {
  const base = config.base_url?.replace(/\/$/, '') || '';
  if (!base) throw new Error('config.base_url requerida');
  const qs = new URLSearchParams({
    consumer_key: config.consumer_key || '',
    consumer_secret: config.consumer_secret || '',
    ...params,
  });
  const url = `${base}/wp-json/wc/v3/${endpoint}?${qs}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'CRM-ISEIH-Connector/1.0' } });
  if (!r.ok) throw new Error(`WC API ${r.status}: ${await r.text().catch(() => '')}`.slice(0, 300));
  return { items: await r.json(), total: parseInt(r.headers.get('x-wp-total') || '0') };
}

// Adaptador WP REST genérico — custom post types con plugin ACF to REST API
async function wpRequest(config, endpoint, params = {}) {
  const base = config.base_url?.replace(/\/$/, '') || '';
  if (!base) throw new Error('config.base_url requerida');
  const qs = new URLSearchParams(params);
  const url = `${base}/wp-json/${endpoint}?${qs}`;
  const headers = { 'User-Agent': 'CRM-ISEIH-Connector/1.0' };
  // Auth: basic con application password si está configurada
  if (config.wp_user && config.wp_app_password) {
    const token = Buffer.from(`${config.wp_user}:${config.wp_app_password}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`WP API ${r.status}: ${await r.text().catch(() => '')}`.slice(0, 300));
  return { items: await r.json(), total: parseInt(r.headers.get('x-wp-total') || '0') };
}

// Adaptador genérico para cualquier API REST/JSON
async function customRequest(config, params = {}) {
  if (!config.url) throw new Error('config.url requerida');
  const url = config.url + (config.url.includes('?') ? '&' : '?') + new URLSearchParams(params).toString();
  const headers = { 'User-Agent': 'CRM-ISEIH-Connector/1.0', ...(config.headers || {}) };
  if (config.bearer_token) headers['Authorization'] = `Bearer ${config.bearer_token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const data = await r.json();
  // Si la respuesta tiene un wrapper, extraerlo según config.items_path
  const items = config.items_path ? resolvePath(data, config.items_path) : data;
  return { items: Array.isArray(items) ? items : [items], total: items?.length || 0 };
}

const PER_PAGE = 100;
const MAX_PAGES = 50;

async function fetchAllPagesWc(config, endpoint, extraParams = {}) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items } = await wcRequest(config, endpoint, { per_page: PER_PAGE, page, ...extraParams });
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

export async function fetchSample(connector) {
  const { type, config } = connector;
  switch (type) {
    case 'woocommerce_products': {
      const { items, total } = await wcRequest(config, 'products', { per_page: 3 });
      return { items, total };
    }
    case 'woocommerce_orders': {
      const { items, total } = await wcRequest(config, 'orders', { per_page: 3 });
      return { items, total };
    }
    case 'wp_rest': {
      const endpoint = config.endpoint || 'wp/v2/posts';
      const { items, total } = await wpRequest(config, endpoint, { per_page: 3 });
      return { items, total };
    }
    case 'acf': {
      // ACF to REST API: requiere plugin instalado. Endpoint típico /acf/v3/{post_type}/{id}
      const endpoint = config.endpoint || 'acf/v3/posts';
      const { items, total } = await wpRequest(config, endpoint, { per_page: 3 });
      return { items, total };
    }
    case 'custom_api': {
      const { items, total } = await customRequest(config);
      return { items: items.slice(0, 3), total };
    }
    default:
      throw new Error(`Tipo de conector desconocido: ${type}`);
  }
}

export async function fetchAll(connector) {
  const { type, config } = connector;
  switch (type) {
    case 'woocommerce_products':
      return fetchAllPagesWc(config, 'products');
    case 'woocommerce_orders':
      return fetchAllPagesWc(config, 'orders');
    case 'wp_rest':
    case 'acf': {
      const endpoint = config.endpoint || (type === 'acf' ? 'acf/v3/posts' : 'wp/v2/posts');
      const all = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { items } = await wpRequest(config, endpoint, { per_page: PER_PAGE, page });
        if (!Array.isArray(items) || items.length === 0) break;
        all.push(...items);
        if (items.length < PER_PAGE) break;
      }
      return all;
    }
    case 'custom_api': {
      const { items } = await customRequest(config);
      return items;
    }
    default:
      throw new Error(`Tipo de conector desconocido: ${type}`);
  }
}
