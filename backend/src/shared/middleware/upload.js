import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new AppError('Solo se permiten archivos PDF', 400, 'INVALID_FILE_TYPE'), false);
  }
  cb(null, true);
}

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).single('file');

export function validatePdfMagicBytes(req, _res, next) {
  if (!req.file) {
    return next(new AppError('Archivo PDF requerido', 400, 'FILE_REQUIRED'));
  }

  const header = req.file.buffer.subarray(0, 4);
  if (!header.equals(PDF_MAGIC_BYTES)) {
    return next(new AppError('El archivo no es un PDF valido', 400, 'INVALID_FILE_TYPE'));
  }

  next();
}
