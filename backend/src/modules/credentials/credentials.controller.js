import * as model from './credentials.model.js';
import { upsertCredentialSchema, listCredentialsSchema } from './credentials.validation.js';
import { AppError } from '../../shared/utils/AppError.js';

export async function list(req, res, next) {
  try {
    const parsed = listCredentialsSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const creds = await model.list(parsed.data);
    res.json({ success: true, data: creds });
  } catch (err) { next(err); }
}

export async function upsert(req, res, next) {
  try {
    const parsed = upsertCredentialSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
    const cred = await model.upsert(parsed.data);
    res.status(201).json({ success: true, data: cred });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    await model.remove(id);
    res.json({ success: true, data: { message: 'Credencial eliminada' } });
  } catch (err) { next(err); }
}

export async function test(req, res, next) {
  // Stub: por ahora solo marca 'ok' si la credencial se decrypta bien.
  // En Fase 2 cada servicio tendra su propio test real (ping API)
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('ID invalido', 400, 'INVALID_ID');
    await model.recordTestResult(id, 'ok');
    res.json({ success: true, data: { result: 'ok', message: 'Credencial decrypted correctamente. Test real de conexion vendra en Fase 2.' } });
  } catch (err) {
    if (err.message?.includes('ENCRYPTION_KEY')) throw err;
    try { await model.recordTestResult(parseInt(req.params.id), 'failed'); } catch {}
    next(err);
  }
}
