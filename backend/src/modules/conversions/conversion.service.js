import { AppError } from '../../shared/utils/AppError.js';
import * as conversionModel from './conversion.model.js';

export async function create(data, userId) {
  // Validar que el lead pertenece al project_id
  const ok = await conversionModel.leadBelongsToProject(data.lead_id, data.project_id);
  if (!ok) throw new AppError('El lead no pertenece a este proyecto', 400, 'LEAD_PROJECT_MISMATCH');

  return await conversionModel.create({ ...data, changed_by: userId });
}

export async function getById(id) {
  const conversion = await conversionModel.findById(id);
  if (!conversion) throw new AppError('Conversion no encontrada', 404, 'CONVERSION_NOT_FOUND');
  return conversion;
}

export async function listByLead(leadId) {
  return await conversionModel.findByLead(leadId);
}

export async function list(filters) {
  return await conversionModel.findAll(filters);
}

export async function update(id, fields) {
  const existing = await conversionModel.findById(id);
  if (!existing) throw new AppError('Conversion no encontrada', 404, 'CONVERSION_NOT_FOUND');

  // Si cambian importe_total, no puede ser menor a importe_pagado
  if (fields.importe_total !== undefined && fields.importe_total < Number(existing.importe_pagado)) {
    throw new AppError('importe_total no puede ser menor a importe_pagado', 400, 'INVALID_TOTAL');
  }

  const updated = await conversionModel.update(id, fields);
  if (!updated) throw new AppError('No se actualizo', 400, 'NO_FIELDS');
  return updated;
}

export async function addPayment(conversionId, data) {
  const result = await conversionModel.addPayment(conversionId, data);
  if (result.error === 'NOT_FOUND') throw new AppError('Conversion no encontrada', 404, 'CONVERSION_NOT_FOUND');
  if (result.error === 'OVERPAY') throw new AppError('El importe excede el pendiente', 400, 'OVERPAY');
  return result;
}

export async function removePayment(paymentId) {
  const deleted = await conversionModel.deletePayment(paymentId);
  if (!deleted) throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  return { message: 'Pago eliminado' };
}

export async function remove(id) {
  const existing = await conversionModel.findById(id);
  if (!existing) throw new AppError('Conversion no encontrada', 404, 'CONVERSION_NOT_FOUND');
  await conversionModel.deleteConversion(id);
  return { message: 'Conversion eliminada' };
}
