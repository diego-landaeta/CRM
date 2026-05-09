import * as ProductService from './product.service.js';
import { createProductSchema, updateProductSchema } from './product.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

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
