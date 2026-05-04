import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { AppError } from '../../shared/utils/AppError.js';
import * as model from './documents.model.js';
import { generateInvoicePdf, generateCertificatePdf } from './documents.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mismo default que documents.service.js — fallback Windows-friendly cuando
// no se setea UPLOAD_DIR en .env (en prod Linux suele ser /var/crm-uploads/...).
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads/documents');

function formatDate(n, prefix) {
  const y = new Date().getFullYear();
  return `${prefix}-${y}-${String(n).padStart(4, '0')}`;
}

export async function generate(req, res, next) {
  try {
    const { projectId, type, numero_override } = req.body;
    if (!projectId || !type) throw new AppError('projectId y type requeridos', 400);
    if (!['invoice', 'certificate'].includes(type)) throw new AppError('type inválido', 400);

    // Si el form pasa un numero manual, reposicionamos el contador antes de
    // pedir el siguiente. La sucesion posterior continua desde ese valor.
    if (numero_override != null && numero_override !== '') {
      const nOverride = parseInt(numero_override, 10);
      if (Number.isFinite(nOverride) && nOverride >= 1) {
        await model.setNextNumber(projectId, type, nOverride);
      }
    }

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

    // Path stored en DB. En docs viejos puede apuntar a UPLOAD_DIR antiguo
    // (e.g. /var/crm-uploads/... que no existe en Windows). Si no se encuentra
    // ahi, probamos el UPLOAD_DIR actual con el mismo basename. Si tampoco,
    // regeneramos el PDF desde `doc.data` y reescribimos el path en la DB.
    let filePath = doc.file_path;
    try {
      await fs.access(filePath);
    } catch {
      const fallback = path.join(UPLOAD_DIR, path.basename(doc.file_path));
      try {
        await fs.access(fallback);
        filePath = fallback;
      } catch {
        // Regenerar desde la data original — usa el UPLOAD_DIR actual.
        const filename = path.basename(doc.file_path);
        filePath = doc.type === 'invoice'
          ? await generateInvoicePdf(doc.data, filename)
          : await generateCertificatePdf(doc.data, filename);
        await model.updateFilePath(doc.id, filePath);
      }
    }

    res.download(filePath, path.basename(filePath));
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
    const { buildInvoicePreviewHtml, buildCertPreviewHtml } = await import('./documents.service.js');
    const html = type === 'invoice' ? buildInvoicePreviewHtml(data) : await buildCertPreviewHtml(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
}

// Peek: devuelve el siguiente numero sin incrementar el contador. El form lo
// muestra al usuario y le permite override manual antes de generar.
export async function peekNumber(req, res, next) {
  try {
    const projectId = parseInt(req.query.projectId);
    const type = req.query.type;
    if (!projectId || !type) throw new AppError('projectId y type requeridos', 400);
    if (!['invoice', 'certificate'].includes(type)) throw new AppError('type invalido', 400);
    const n = await model.peekNextNumber(projectId, type);
    const prefix = type === 'invoice' ? 'FAC' : 'CERT';
    const formatted = formatDate(n, prefix);
    res.json({ success: true, data: { number: n, formatted } });
  } catch (err) {
    next(err);
  }
}

// Permite ajustar manualmente el contador desde un panel de configuracion sin
// generar un documento. Util para "establecer inicio de factura = 200".
export async function setNumber(req, res, next) {
  try {
    const { projectId, type, value } = req.body;
    if (!projectId || !type || value == null) throw new AppError('projectId, type y value requeridos', 400);
    if (!['invoice', 'certificate'].includes(type)) throw new AppError('type invalido', 400);
    const v = parseInt(value, 10);
    if (!Number.isFinite(v) || v < 1) throw new AppError('value debe ser un entero >= 1', 400);
    await model.setNextNumber(projectId, type, v);
    res.json({ success: true, data: { next: v } });
  } catch (err) {
    next(err);
  }
}
