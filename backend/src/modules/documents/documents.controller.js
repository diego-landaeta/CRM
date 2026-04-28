import path from 'path';
import fs from 'fs/promises';
import { AppError } from '../../shared/utils/AppError.js';
import * as model from './documents.model.js';
import { generateInvoicePdf, generateCertificatePdf } from './documents.service.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/crm-uploads/documents';

function formatDate(n, prefix) {
  const y = new Date().getFullYear();
  return `${prefix}-${y}-${String(n).padStart(4, '0')}`;
}

export async function generate(req, res, next) {
  try {
    const { projectId, type } = req.body;
    if (!projectId || !type) throw new AppError('projectId y type requeridos', 400);
    if (!['invoice', 'certificate'].includes(type)) throw new AppError('type inválido', 400);

    const n = await model.nextNumber(projectId, type);
    const prefix = type === 'invoice' ? 'FAC' : 'CERT';
    const number = formatDate(n, prefix);
    const filename = `${number}.pdf`;

    let filePath;
    const data = req.body.data || {};
    data.numero = n;

    if (type === 'invoice') {
      filePath = await generateInvoicePdf(data, filename);
    } else {
      filePath = await generateCertificatePdf(data, filename);
    }

    const doc = await model.createDocument({
      project_id: projectId,
      type,
      number,
      client_nombre: data.cliente_nombre || data.alumno_nombre || null,
      client_dni: data.cliente_dni || data.alumno_dni || null,
      client_direccion: data.cliente_direccion || null,
      data,
      file_path: filePath,
      created_by: req.user.id,
    });

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    if (!projectId) throw new AppError('projectId requerido', 400);
    const docs = await model.listDocuments(projectId, req.query.type);
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

export async function download(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    const doc = await model.getDocument(parseInt(req.params.id), projectId);
    if (!doc) throw new AppError('Documento no encontrado', 404);
    if (!doc.file_path) throw new AppError('Archivo no disponible', 404);
    await fs.access(doc.file_path);
    res.download(doc.file_path, path.basename(doc.file_path));
  } catch (err) {
    if (err.code === 'ENOENT') return next(new AppError('Archivo no encontrado en disco', 404));
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    const doc = await model.getDocument(parseInt(req.params.id), projectId);
    if (!doc) throw new AppError('Documento no encontrado', 404);
    if (doc.file_path) {
      try { await fs.unlink(doc.file_path); } catch {}
    }
    await model.deleteDocument(doc.id, projectId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function preview(req, res, next) {
  try {
    const { type, data } = req.body;
    const { buildInvoiceHtml, buildCertP1Html } = await import('./documents.service.js');
    const html = type === 'invoice' ? buildInvoiceHtml(data) : buildCertP1Html(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
}
