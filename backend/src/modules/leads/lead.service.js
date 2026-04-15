import { AppError } from '../../shared/utils/AppError.js';
import * as leadModel from './lead.model.js';

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

  // TODO: enviar email Brevo asincrono al gestor asignado (CRM-56)

  return {
    lead_id: lead.id,
    responsable_id: lead.responsableId,
    duplicado: !!duplicadoDe,
    duplicado_de: duplicadoDe,
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

// ============================================================
// OPERACIONES
// ============================================================

export async function changeStatus(leadId, newStatus, motivo, userId) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');
  if (lead.status === newStatus) throw new AppError('El lead ya tiene ese status', 400, 'SAME_STATUS');

  await leadModel.updateStatus(leadId, newStatus, lead.status, userId);
  return { previous: lead.status, current: newStatus };
}

export async function addInteraction(leadId, tipo, nota, userId) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  return await leadModel.createInteraction(leadId, tipo, nota, userId);
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

export async function updateLead(leadId, data) {
  const lead = await leadModel.findById(leadId);
  if (!lead) throw new AppError('Lead no encontrado', 404, 'LEAD_NOT_FOUND');

  const updated = await leadModel.updateLead(leadId, data);
  if (!updated) throw new AppError('No se actualizo el lead', 400, 'NO_FIELDS');
  return updated;
}
