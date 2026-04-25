import * as leadService from './lead.service.js';
import { webhookLeadSchema, listLeadsSchema, updateStatusSchema, createInteractionSchema, createReminderSchema, reassignSchema, updateLeadSchema, createLeadManualSchema } from './lead.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

// ============================================================
// WEBHOOK (publico, autenticado por API key en header)
// ============================================================

export async function webhook(req, res, next) {
  try {
    const { slug } = req.params;
    // Acepta Authorization: Bearer {key} (PDF spec) o X-API-Key (compat)
    let apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7).trim();
      }
    }
    if (!apiKey) throw new AppError('API key requerida (Authorization: Bearer o X-API-Key)', 401, 'API_KEY_REQUIRED');

    const parsed = webhookLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const result = await leadService.processWebhook(slug, apiKey, parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ============================================================
// LISTADO + DETALLE + STATS
// ============================================================

export async function list(req, res, next) {
  try {
    const parsed = listLeadsSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.list(parsed.data);
    res.json({
      success: true,
      data: result.leads,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
    });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const lead = await leadService.getById(id);
    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
}

export async function today(req, res, next) {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId) : null;
    const data = await leadService.getTodaySummary({
      userId: req.user.userId,
      role: req.user.role,
      projectId: projectId && !isNaN(projectId) ? projectId : null,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function stats(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    if (isNaN(projectId)) throw new AppError('projectId requerido', 400, 'MISSING_PROJECT');
    const data = await leadService.getStats(projectId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ============================================================
// OPERACIONES
// ============================================================

export async function changeStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.changeStatus(id, parsed.data.status, parsed.data.motivo, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function addInteraction(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = createInteractionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.addInteraction(id, parsed.data.tipo, parsed.data.nota, req.user.userId, parsed.data.fecha);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function addReminder(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = createReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.addReminder(id, parsed.data.fecha_recordatorio, parsed.data.nota, req.user.userId);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function completeReminder(req, res, next) {
  try {
    const reminderId = parseInt(req.params.reminderId);
    if (isNaN(reminderId)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const result = await leadService.markReminderComplete(reminderId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function createManual(req, res, next) {
  try {
    const parsed = createLeadManualSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.createManualLead(parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// CRM-import CSV: bulk insert con tolerancia a errores por fila
export async function bulkCreate(req, res, next) {
  try {
    const { projectId, leads } = req.body || {};
    if (!projectId || !Array.isArray(leads)) {
      throw new AppError('projectId y leads[] requeridos', 400, 'VALIDATION_ERROR');
    }
    if (leads.length > 500) {
      throw new AppError('Maximo 500 leads por bulk', 400, 'BULK_TOO_LARGE');
    }
    let ok = 0; let fail = 0; const errors = [];
    const created = [];
    for (let i = 0; i < leads.length; i++) {
      const row = leads[i] || {};
      try {
        if (!row.nombre || !row.email) throw new Error('nombre y email requeridos');
        const result = await leadService.createManualLead({
          project_id: Number(projectId),
          nombre: row.nombre,
          email: String(row.email).toLowerCase().trim(),
          telefono: row.telefono || null,
          notas: row.notas || null,
          producto_interes_id: row.producto_interes_id ? parseInt(row.producto_interes_id) : null,
          canal: row.canal || null,
        });
        created.push({ line: i + 1, lead_id: result.lead_id || result.id });
        ok++;
      } catch (err) {
        errors.push({ line: i + 1, email: row.email || null, error: err.message?.slice(0, 200) || 'error' });
        fail++;
      }
    }
    res.status(201).json({ success: true, data: { ok, fail, errors, created } });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.updateLead(id, parsed.data);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function reassign(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = reassignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    const result = await leadService.reassign(id, parsed.data.responsable_id, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
