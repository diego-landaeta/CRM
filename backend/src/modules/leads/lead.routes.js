import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as leadController from './lead.controller.js';

const router = Router();

// ============================================================
// WEBHOOK (publico, autenticado por X-API-Key header)
// ============================================================
router.post('/webhooks/:slug', leadController.webhook);

// ============================================================
// RUTAS PROTEGIDAS
// ============================================================
router.use(verifyToken);

// Listado y detalle
router.get('/', leadController.list);
router.get('/stats', leadController.stats);
router.get('/:id', leadController.getById);

// Operaciones sobre lead
router.patch('/:id/status', leadController.changeStatus);
router.post('/:id/interactions', leadController.addInteraction);
router.post('/:id/reminders', leadController.addReminder);
router.patch('/reminders/:reminderId/complete', leadController.completeReminder);

// Reasignar (solo admin/superadmin)
router.patch('/:id/reassign', roleGuard('admin', 'superadmin'), leadController.reassign);

export default router;
