import { AppError } from '../../shared/utils/AppError.js';
import * as leadModel from './lead.model.js';
import * as seqModel from '../email-sequences/sequence.model.js';
import { query } from '../../shared/config/db.js';
import { sendLeadAssignedEmail } from '../../shared/services/brevo.service.js';
import { logger } from '../../shared/utils/logger.js';

// Dispara secuencias de email activas que tengan el trigger indicado
async function triggerSequences(triggerEvent, leadId, projectId) {
  try {
    const { rows: seqs } = await query(
      `SELECT id FROM email_sequences WHERE project_id = $1 AND trigger_event = $2 AND active = true`,
      [projectId, triggerEvent]
    );
    for (const seq of seqs) {
      await seqModel.startRun(seq.id, leadId);
    }
    if (seqs.length) logger.info({ triggerEvent, leadId, count: seqs.length }, 'Email sequences disparadas');
  } catch (err) {
    logger.warn({ err: err.message, triggerEvent, leadId }, 'Error disparando email sequences');
  }
}

// ============================================================
// DETECCION DE CANAL POR UTMs
// ============================================================

function detectChannel(utmSource, utmMedium) {
  if (!utmSource && !utmMedium) return 'directo';

  const source = (utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  if (source.includes('facebook') || source.includes('instagram') || source.includes('fb') || source.includes('meta')) return 'meta_ads';
  if (source.includes('google') && (medium === 'cpc' || medium === 'ppc')) return 'google_ads';
  if (source.includes('tiktok')) return 'tiktok_ads';
  if (source.includes('chatgpt') || source.includes('openai')) return 'chatgpt_ia';
  if (medium === 'referral' || source.includes('referido')) return 'referido';
  if (medium === 'organic' || source.includes('google') || source.includes('bing')) return 'organico';

  return 'directo';
}

// ============================================================
// WEBHOOK (publico, autenticado por API key)
// ============================================================

export async function processWebhook(slug, apiKey, leadData) {
  const project = await leadModel.findProjectBySlug(slug);
  if (!project) throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
  if (project.webhook_api_key !== apiKey) throw new AppError('API key invalida', 401, 'INVALID_API_KEY');

  // Buscar producto por nombre si viene
  let productoInteresId = null;
  if (leadData.producto_interes) {
    const product = await leadModel.findProductByName(leadData.producto_interes, project.id);
    if (product) productoInteresId = product.id;
  }

  // Detectar duplicado
  const duplicate = await leadModel.findDuplicateByEmail(leadData.email, project.id);
  const duplicadoDe = duplicate ? duplicate.id : null;

  // Reincidente = mismo proyecto + mismo producto que duplicado
  const reincidente = !!(
    duplicate &&
    productoInteresId &&
    duplicate.producto_interes_id === productoInteresId
  );

  // Detectar canal
  const canalDetectado = detectChannel(leadData.utm_source, leadData.utm_medium);

  // Crear lead con round-robin
  const lead = await leadModel.createLeadWithRoundRobin({
    projectId: project.id,
    nombre: leadData.nombre,
    email: leadData.email,
    telefono: leadData.telefono || null,
    productoInteresId,
    notas: leadData.notas || null,
    landingUrl: leadData.landing_url || null,
    duplicadoDe,
    reincidente,
    utms: {
      utm_source: leadData.utm_source || null,
      utm_medium: leadData.utm_medium || null,
      utm_campaign: leadData.utm_campaign || null,
      utm_content: leadData.utm_content || null,
      utm_term: leadData.utm_term || null,
      landing_url: leadData.landing_url || null,
      canal_detectado: canalDetectado,
    },
  });

  // Disparar email sequences con trigger lead_created (async)
  triggerSequences('lead_created', lead.id, project.id);

  // Notificar al gestor asignado (async - no bloquea respuesta del webhook <500ms)
  if (lead.responsableId) {
    (async () => {
      try {
        const { rows } = await query(`SELECT id, nombre, email FROM users WHERE id = $1`, [lead.responsableId]);
        if (rows[0]?.email) {
          const baseUrl = process.env.CRM_BASE_URL || 'http://localhost:5173/crm';
          await sendLeadAssignedEmail({
            gestor: rows[0],
            lead: { id: lead.id, nombre: lead.nombre, email: lead.email, telefono: lead.telefono },
            proyecto: { nombre: project.nombre },
            baseUrl,
          });
        }
      } catch (err) {
        logger.warn({ err: err.message, leadId: lead.id }, 'Notificacion gestor fallo');
      }
    })();
  }

  return {
    lead_id: lead.id,
    responsable_id: lead.responsableId,
    duplicado: !!duplicadoDe,
    duplicado_de: duplicadoDe,
    reincidente,
    canal: canalDetectado,
  };
}

// ============================================================
// LISTADO + DETALLE
// ============================================================

export async function list(filters) {
  return await leadModel.findAll(filters);
}

export async function getById(id) {
  const lead = await leadModel.findById(id);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');
  return lead;
}

export async function getStats(projectId) {
  return await leadModel.getStats(projectId);
}

export async function getTodaySummary(ctx) {
  return await leadModel.getTodaySummary(ctx);
}

// ============================================================
// OPERACIONES
// ============================================================

export async function changeStatus(leadId, newStatus, motivo, userId) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');
  if (lead.status === newStatus) throw new AppError('El lead ya tiene ese status', 400, 'SAME_STATUS');

  await leadModel.updateStatus(leadId, newStatus, lead.status, userId);

  // Disparar email sequences con trigger status_changed (async)
  triggerSequences('status_changed', leadId, lead.project_id);

  return { previous: lead.status, current: newStatus };
}

export async function addInteraction(leadId, tipo, nota, userId, fecha) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  return await leadModel.createInteraction(leadId, tipo, nota, userId, fecha);
}

export async function addReminder(leadId, fechaRecordatorio, nota, userId) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  return await leadModel.createReminder(leadId, fechaRecordatorio, nota, userId);
}

export async function markReminderComplete(reminderId) {
  await leadModel.completeReminder(reminderId);
  return { message: 'Recordatorio completado' };
}

export async function reassign(leadId, newResponsableId, userId) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  await leadModel.reassignLead(leadId, newResponsableId);
  await leadModel.updateStatus(leadId, lead.status, lead.status, userId);

  return { message: 'Lead reasignado', responsable_id: newResponsableId };
}

export async function reassignPending(projectId) {
  return await leadModel.reassignPendingRoundRobin(projectId);
}

export async function createManualLead({ project_id, nombre, email, telefono, producto_interes_id, canal, notas, custom_fields }) {
  // Detectar duplicado
  const duplicate = await leadModel.findDuplicateByEmail(email, project_id);

  // Dedupe rapido: si el duplicado es del mismo nombre y fue creado en los ultimos 10s,
  // asumimos doble submit y devolvemos el lead existente en vez de crear otro
  if (duplicate && duplicate.nombre === nombre) {
    const age = Date.now() - new Date(duplicate.created_at || duplicate.fecha_solicitud).getTime();
    if (age < 10_000) {
      return {
        lead_id: duplicate.id,
        responsable_id: duplicate.responsable_id,
        duplicado: true,
        reincidente: false,
        deduped: true,
      };
    }
  }

  const duplicadoDe = duplicate ? duplicate.id : null;

  const reincidente = !!(
    duplicate &&
    producto_interes_id &&
    duplicate.producto_interes_id === producto_interes_id
  );

  const lead = await leadModel.createLeadWithRoundRobin({
    projectId: project_id,
    nombre,
    email,
    telefono: telefono || null,
    productoInteresId: producto_interes_id || null,
    notas: notas || null,
    landingUrl: null,
    duplicadoDe,
    reincidente,
    utms: {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      landing_url: null,
      canal_detectado: canal || 'directo',
    },
    customFields: custom_fields,
  });

  // Disparar email sequences con trigger lead_created (async)
  triggerSequences('lead_created', lead.id, project_id);

  return {
    lead_id: lead.id,
    responsable_id: lead.responsableId,
    duplicado: !!duplicadoDe,
    duplicado_de: duplicadoDe,
    reincidente,
    canal: canal || 'directo',
  };
}

export async function updateLead(leadId, data) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  const updated = await leadModel.updateLead(leadId, data);
  if (!updated) throw new AppError('No se actualizo el lead', 400, 'NO_FIELDS');
  return updated;
}

export async function getLeadSequences(leadId, requestUser) {
  const { rows } = await query(
    `SELECT
       r.id AS run_id,
       r.status,
       r.current_step,
       r.next_send_at,
       r.created_at AS enrolled_at,
       s.id AS sequence_id,
       s.nombre,
       s.trigger_event,
       COALESCE(jsonb_array_length(s.steps), 0) AS total_steps
     FROM email_sequence_runs r
     JOIN email_sequences s ON s.id = r.sequence_id
     WHERE r.lead_id = $1
     ORDER BY r.created_at DESC`,
    [leadId]
  );
  return rows;
}
