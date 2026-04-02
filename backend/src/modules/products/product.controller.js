import * as ProductService from './product.service.js';
import { createProductSchema, updateProductSchema } from './product.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

export async function list(req, res, next) {
  try {
    const products = await ProductService.listByProject(req.projectId);
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const product = await ProductService.getById(Number(req.params.id), req.projectId);
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
