import * as conversionService from './conversion.service.js';
import {
  createConversionSchema,
  updateConversionSchema,
  createPaymentSchema,
  listConversionsSchema,
} from './conversion.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

export async function create(req, res, next) {
  try {
    const parsed = createConversionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const conversion = await conversionService.create(parsed.data, req.user.userId);
    res.status(201).json({ success: true, data: conversion });
  } catch (err) { next(err); }
}

export async function list(req, res, next) {
  try {
    const parsed = listConversionsSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const result = await conversionService.list(parsed.data);
    res.json({
      success: true,
      data: result.conversions,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
    });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const conv = await conversionService.getById(id);
    res.json({ success: true, data: conv });
  } catch (err) { next(err); }
}

export async function listByLead(req, res, next) {
  try {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) throw new AppError('leadId invalido', 400, 'INVALID_ID');
    const conversions = await conversionService.listByLead(leadId);
    res.json({ success: true, data: conversions });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = updateConversionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const updated = await conversionService.update(id, parsed.data);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function addPayment(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const result = await conversionService.addPayment(id, parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function removePayment(req, res, next) {
  try {
    const paymentId = parseInt(req.params.paymentId);
    if (isNaN(paymentId)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const result = await conversionService.removePayment(paymentId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    const result = await conversionService.remove(id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
