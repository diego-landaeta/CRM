import * as userService from './user.service.js';
import { createUserSchema, updateUserSchema, listUsersSchema } from './user.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

export async function list(req, res, next) {
  try {
    const parsed = listUsersSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await userService.list(parsed.data);
    res.json({
      success: true,
      data: result.users,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
    });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const user = await userService.getById(id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const user = await userService.create(parsed.data);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const user = await userService.update(id, parsed.data);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function deactivate(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const result = await userService.deactivate(id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function reactivate(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const result = await userService.reactivate(id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
