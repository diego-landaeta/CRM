import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as leadController from './lead.controller.js';
import * as leadEmailsController from './lead-emails.controller.js';

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
router.get('/today', leadController.today);
router.get('/:id', leadController.getById);

// Creacion manual (formulario interno)
router.post('/', leadController.createManual);

// Import CSV (bulk)
router.post('/bulk', leadController.bulkCreate);

// Edicion general del lead
router.patch('/:id', leadController.update);

// Operaciones sobre lead
router.patch('/:id/status', leadController.changeStatus);
router.post('/:id/interactions', leadController.addInteraction);
router.post('/:id/reminders', leadController.addReminder);
router.patch('/reminders/:reminderId/complete', leadController.completeReminder);

// Secuencias de email del lead (para popup de detalle)
router.get('/:id/sequences', leadController.getLeadSequences);

// Envío manual de email + historial (CRM-231)
router.post('/:id/send-email', leadEmailsController.sendLeadEmail);
router.get('/:id/emails', leadEmailsController.listLeadEmails);

// Reasignar (solo admin/superadmin)
router.patch('/:id/reassign', roleGuard('admin', 'superadmin'), leadController.reassign);

// Asignar pendientes: re-aplica round-robin a leads con responsable_id IS NULL.
// Útil cuando llegan leads sin gestores activos y luego se activan.
router.post('/reassign-pending', roleGuard('admin', 'superadmin'), leadController.reassignPending);

export default router;
