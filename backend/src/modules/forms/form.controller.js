import { z } from 'zod';
import * as model from './form.model.js';
import { AppError } from '../../shared/utils/AppError.js';
import * as leadModel from '../leads/lead.model.js';
import * as matriculaModel from '../matriculas/matricula.model.js';

const createSchema = z.object({
  project_id: z.number().int().positive(),
  nombre: z.string().min(1).max(200),
  kind: z.enum(['form', 'webhook']).optional(),
  destination: z.enum(['lead', 'matricula']).optional(),
  template_kind: z.enum(['contacto_basico', 'lead_con_producto', 'custom']).optional(),
  schema: z.record(z.string(), z.any()).optional(),
  config: z.record(z.string(), z.any()).optional(),
  field_mapping: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});
const updateSchema = createSchema.partial().omit({ project_id: true });

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    if (!projectId) throw new AppError('projectId requerido', 400, 'PROJECT_REQUIRED');
    res.json({ success: true, data: await model.findAll(projectId) });
  } catch (err) { next(err); }
}
export async function getById(req, res, next) {
  try {
    const f = await model.findById(parseInt(req.params.id));
    if (!f) throw new AppError('Form no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: f });
  } catch (err) { next(err); }
}
export async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Datos invalidos', 400, 'VALIDATION_ERROR');
    res.status(201).json({ success: true, data: await model.create({ ...parsed.data, created_by: req.user.id }) });
  } catch (err) { next(err); }
}
export async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Datos invalidos', 400, 'VALIDATION_ERROR');
    const u = await model.update(parseInt(req.params.id), parsed.data);
    if (!u) throw new AppError('Form no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: u });
  } catch (err) { next(err); }
}
export async function remove(req, res, next) {
  try { await model.remove(parseInt(req.params.id)); res.json({ success: true }); }
  catch (err) { next(err); }
}

export async function startListening(req, res, next) {
  try {
    const r = await model.setListenMode(parseInt(req.params.id), true);
    if (!r) throw new AppError('Form no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
}
export async function stopListening(req, res, next) {
  try {
    const r = await model.setListenMode(parseInt(req.params.id), false);
    if (!r) throw new AppError('Form no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
}
export async function getStatus(req, res, next) {
  try {
    const f = await model.findById(parseInt(req.params.id));
    if (!f) throw new AppError('Form no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: { awaiting_sample: f.awaiting_sample, sample_payload: f.sample_payload, sample_received_at: f.sample_received_at, field_mapping: f.field_mapping } });
  } catch (err) { next(err); }
}

// PUBLIC: render meta del form (frontend embed lo lee)
export async function publicMeta(req, res, next) {
  try {
    const f = await model.findByEmbed(req.params.embedId);
    if (!f) throw new AppError('Form no disponible', 404, 'NOT_FOUND');
    res.json({
      success: true, data: {
        nombre: f.nombre,
        template_kind: f.template_kind,
        schema: f.schema,
        config: f.config,
        project: { nombre: f.project_nombre, emoji: f.project_emoji, logo: f.project_logo, producto_label: f.producto_label, producto_label_plural: f.producto_label_plural },
      },
    });
  } catch (err) { next(err); }
}

// Resuelve un path tipo "data.contact.email" sobre un objeto
function resolvePath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

// PUBLIC: webhook receptor. Acepta payload arbitrario y aplica field_mapping.
export async function publicWebhook(req, res, next) {
  try {
    const f = await model.findByEmbed(req.params.embedId);
    if (!f || f.kind !== 'webhook') throw new AppError('Webhook no disponible', 404, 'NOT_FOUND');

    // Modo escucha: capturar payload sin procesar (estilo Make/Zapier)
    if (f.awaiting_sample) {
      await model.saveSample(f.id, req.body || {});
      return res.json({ success: true, data: { mode: 'listen', captured: true, message: 'Payload capturado para mapeo.' } });
    }

    const body = req.body || {};
    const mapping = f.field_mapping || {};
    // Resolver mapping: targetField -> sourcePath dentro de body
    const mapped = {};
    for (const [target, source] of Object.entries(mapping)) {
      const v = resolvePath(body, source);
      if (v !== undefined) mapped[target] = v;
    }
    // Si no hay mapping, asumir keys directas
    const final = Object.keys(mapping).length > 0
      ? mapped
      : { nombre: body.nombre, email: body.email, telefono: body.telefono, notas: body.notas, custom_fields: body.custom_fields };

    // Routing por destination
    const destination = f.destination || 'lead';
    if (destination === 'matricula') {
      const dedupe = final.dni || final.email || null;
      if (dedupe) {
        const exists = await matriculaModel.findByDedupe(f.project_id, dedupe);
        if (exists) {
          await model.incrementSubmissions(f.id);
          return res.json({ success: true, data: { matricula_id: exists.id, action: 'duplicate_skipped' } });
        }
      }
      const m = await matriculaModel.create({
        project_id: f.project_id,
        dni: final.dni || null,
        titulo: final.titulo || null,
        notas: final.notas || null,
        datos_admision: req.body,
        source: 'webhook',
        dedupe_key: dedupe,
        estado: 'solicitud_admision',
      });
      await model.incrementSubmissions(f.id);
      return res.json({ success: true, data: { matricula_id: m.id, action: 'created' } });
    }

    // destination 'lead' (default)
    if (!final.nombre || !final.email) {
      throw new AppError('Para crear lead se requieren nombre y email tras mapeo', 400, 'VALIDATION_ERROR');
    }
    const lead = await leadModel.createLeadWithRoundRobin({
      projectId: f.project_id,
      nombre: final.nombre,
      email: final.email,
      telefono: final.telefono || null,
      productoInteresId: final.producto_interes_id ? parseInt(final.producto_interes_id) : null,
      notas: final.notas || null,
      landingUrl: final.landing_url || null,
      utms: {
        utm_source: final.utm_source || 'webhook',
        utm_medium: final.utm_medium || 'api',
        utm_campaign: final.utm_campaign || f.embed_id,
      },
      customFields: final.custom_fields || {},
    });
    await model.incrementSubmissions(f.id);
    res.json({ success: true, data: { lead_id: lead.id, mapped: Object.keys(final) } });
  } catch (err) { next(err); }
}

// PUBLIC: submission. Crea lead.
export async function publicSubmit(req, res, next) {
  try {
    const f = await model.findByEmbed(req.params.embedId);
    if (!f) throw new AppError('Form no disponible', 404, 'NOT_FOUND');
    const body = req.body || {};
    if (!body.nombre || !body.email) throw new AppError('Nombre y email requeridos', 400, 'VALIDATION_ERROR');
    const lead = await leadModel.createLeadWithRoundRobin({
      projectId: f.project_id,
      nombre: body.nombre,
      email: body.email,
      telefono: body.telefono || null,
      productoInteresId: body.producto_interes_id ? parseInt(body.producto_interes_id) : null,
      notas: body.notas || null,
      landingUrl: body.landing_url || null,
      utms: {
        utm_source: body.utm_source || 'form',
        utm_medium: body.utm_medium || 'embed',
        utm_campaign: body.utm_campaign || f.embed_id,
      },
      customFields: body.custom_fields || {},
    });
    await model.incrementSubmissions(f.id);
    res.json({ success: true, data: { lead_id: lead.id, redirect_url: f.config?.redirect_url || null } });
  } catch (err) { next(err); }
}
