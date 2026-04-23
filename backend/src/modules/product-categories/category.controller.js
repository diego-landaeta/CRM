import { z } from 'zod';
import { AppError } from '../../shared/utils/AppError.js';
import * as model from './category.model.js';

const createSchema = z.object({
  project_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  nombre: z.string().min(1).max(100),
  orden: z.number().int().optional(),
});

const updateSchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  nombre: z.string().min(1).max(100).optional(),
  orden: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function listByProject(req, res, next) {
  try {
    const rows = await model.listByProject(Number(req.params.projectId));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid', 400, 'VALIDATION_ERROR');
    const c = await model.create(parsed.data);
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Invalid', 400, 'VALIDATION_ERROR');
    const c = await model.update(Number(req.params.id), parsed.data);
    if (!c) throw new AppError('No encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    await model.remove(Number(req.params.id));
    res.json({ success: true });
  } catch (err) { next(err); }
}
