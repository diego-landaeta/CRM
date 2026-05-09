import * as ProductService from './product.service.js';
import { createProductSchema, updateProductSchema } from './product.validation.js';
import { AppError } from '../../shared/utils/AppError.js';
import { query } from '../../shared/config/db.js';

export async function list(req, res, next) {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
    const products = await ProductService.listByProject(req.projectId, { categoryId });
    // Resolver presigned URLs en paralelo solo para los que tienen image_url.
    const enriched = await Promise.all(products.map(async (p) => {
      if (!p.image_url) return p;
      try {
        const signed = await ProductService.resolveImageUrl(p.image_url);
        return { ...p, image_url_signed: signed };
      } catch {
        return p;
      }
    }));
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const product = await ProductService.getById(Number(req.params.id), req.projectId);
    if (product.image_url) {
      try {
        product.image_url_signed = await ProductService.resolveImageUrl(product.image_url);
      } catch { /* best-effort */ }
    }
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const parsed = createProductSchema.parse({ ...req.body, projectId: req.projectId });
    const product = await ProductService.create(parsed);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(new AppError(err.errors.map(e => e.message).join(', '), 400, 'VALIDATION_ERROR'));
    }
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const parsed = updateProductSchema.parse(req.body);
    const product = await ProductService.update(Number(req.params.id), req.projectId, parsed);
    res.json({ success: true, data: product });
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(new AppError(err.errors.map(e => e.message).join(', '), 400, 'VALIDATION_ERROR'));
    }
    next(err);
  }
}

export async function deactivate(req, res, next) {
  try {
    const product = await ProductService.deactivate(Number(req.params.id), req.projectId);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function uploadImage(req, res, next) {
  try {
    const product = await ProductService.uploadImage(Number(req.params.id), req.projectId, req.file);
    const url = await ProductService.resolveImageUrl(product.image_url);
    res.status(201).json({ success: true, data: { ...product, image_url_signed: url } });
  } catch (err) { next(err); }
}

export async function removeImage(req, res, next) {
  try {
    const product = await ProductService.removeImage(Number(req.params.id), req.projectId);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function getImageUrl(req, res, next) {
  try {
    const product = await ProductService.getById(Number(req.params.id), req.projectId);
    if (!product.image_url) return res.json({ success: true, data: { url: null } });
    const url = await ProductService.resolveImageUrl(product.image_url);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

// GET /api/products/leads-stats?projectId=X
// Devuelve productos del proyecto con conteo de leads asociados:
//  - direct_count: leads.producto_interes_id = product.id
//  - url_match_count: leads.landing_url normalizado coincide con product.url_info
function _normalize(u) {
  if (!u) return null;
  return String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0].split('#')[0].replace(/\/$/, '');
}

export async function leadsStats(req, res, next) {
  try {
    const projectId = req.projectId;
    const { rows: products } = await query(
      `SELECT id, nombre, url_info FROM products WHERE project_id = $1 AND active = true ORDER BY nombre`,
      [projectId]
    );
    const { rows: directs } = await query(
      `SELECT producto_interes_id AS pid, COUNT(*)::int AS n
       FROM leads WHERE project_id = $1 AND producto_interes_id IS NOT NULL
       GROUP BY producto_interes_id`,
      [projectId]
    );
    const directMap = new Map(directs.map(r => [r.pid, r.n]));

    const { rows: landings } = await query(
      `SELECT landing_url, COUNT(*)::int AS n
       FROM leads WHERE project_id = $1 AND landing_url IS NOT NULL AND landing_url <> ''
       GROUP BY landing_url`,
      [projectId]
    );
    const landingNorm = landings.map(r => ({ key: _normalize(r.landing_url), n: r.n, raw: r.landing_url }));

    const result = products.map(p => {
      const productKey = _normalize(p.url_info);
      const matches = productKey ? landingNorm.filter(l => l.key === productKey) : [];
      const url_match_count = matches.reduce((acc, m) => acc + m.n, 0);
      return {
        id: p.id,
        nombre: p.nombre,
        url_info: p.url_info,
        direct_count: directMap.get(p.id) || 0,
        url_match_count,
        total: (directMap.get(p.id) || 0) + url_match_count,
      };
    });

    const totalLeads = result.reduce((acc, r) => acc + r.total, 0);
    const unmatched = landingNorm.filter(l => !result.some(r => _normalize(r.url_info) === l.key))
      .reduce((acc, l) => acc + l.n, 0);

    res.json({ success: true, data: { products: result, total_leads: totalLeads, unmatched_url_leads: unmatched } });
  } catch (err) { next(err); }
}
