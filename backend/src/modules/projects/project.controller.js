import * as model from './project.model.js';
import { createProjectSchema, updateProjectSchema } from './project.validation.js';
import { AppError } from '../../shared/utils/AppError.js';
import { uploadToR2, getFromR2, deleteFromR2 } from '../../shared/services/r2.service.js';
import crypto from 'crypto';

export async function list(req, res, next) {
  try {
    const projects = await model.findAll({ active: req.query.active });
    res.json({ success: true, data: projects });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const project = await model.findById(id);
    if (!project) throw new AppError('Proyecto no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const exists = await model.slugExists(parsed.data.slug);
    if (exists) throw new AppError('El slug ya existe', 409, 'SLUG_EXISTS');
    const project = await model.create(parsed.data);
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const updated = await model.update(id, parsed.data);
    if (!updated) throw new AppError('No se actualizo', 400, 'NO_FIELDS');
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function uploadLogo(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    if (!req.file) throw new AppError('Imagen requerida (campo file)', 400, 'FILE_REQUIRED');

    const project = await model.findById(id);
    if (!project) throw new AppError('Proyecto no encontrado', 404, 'NOT_FOUND');

    // Si ya habia logo, borrarlo de R2
    if (project.logo_key) {
      try { await deleteFromR2(project.logo_key); } catch {}
    }

    const ext = req.file.mimetype === 'image/svg+xml' ? 'svg'
              : req.file.mimetype === 'image/png' ? 'png'
              : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `logos/project-${id}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    await uploadToR2(key, req.file.buffer, req.file.mimetype);

    const logoUrl = `/api/projects/${id}/logo?v=${Date.now()}`;
    const updated = await model.update(id, { logo_url: logoUrl, logo_key: key });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function getLogo(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const project = await model.findById(id);
    if (!project?.logo_key) return res.status(404).end();

    const obj = await getFromR2(project.logo_key);
    res.setHeader('Content-Type', obj.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (obj.contentLength) res.setHeader('Content-Length', obj.contentLength);
    obj.body.pipe(res);
  } catch (err) { next(err); }
}

export async function deleteLogo(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const project = await model.findById(id);
    if (!project) throw new AppError('Proyecto no encontrado', 404, 'NOT_FOUND');
    if (project.logo_key) {
      try { await deleteFromR2(project.logo_key); } catch {}
    }
    const updated = await model.update(id, { logo_url: null, logo_key: null });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function regenerateKey(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const newKey = await model.regenerateWebhookKey(id);
    if (!newKey) throw new AppError('Proyecto no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: { webhook_api_key: newKey } });
  } catch (err) { next(err); }
}
