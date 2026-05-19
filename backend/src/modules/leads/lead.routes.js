import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as leadController from './lead.controller.js';
import * as leadEmailsController from './lead-emails.controller.js';
import * as spamReportController from './spam-report.controller.js';

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
// Lookup público para gestores: devuelve metadata mínima de leads con el
// email indicado, ignorando el RBAC de listado normal. Para que un gestor
// pueda detectar duplicados de leads que pertenecen a otra asesora.
router.get('/lookup-by-email', leadController.lookupByEmail);

// Spam reports: rutas estáticas ANTES de /:id para que no las absorba
router.get('/spam-reports', roleGuard('superadmin'), spamReportController.listPending);
router.get('/spam-reports/count', roleGuard('superadmin'), spamReportController.countPending);
router.patch('/spam-reports/:reportId', roleGuard('superadmin'), spamReportController.resolveReport);

router.get('/:id', leadController.getById);
router.post('/:id/merge', leadController.mergeLeads);

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

// Historial de compra del email del lead (cross-sell / propuesto)
router.get('/:id/purchase-history', leadController.getPurchaseHistory);

// Envío manual de email + historial (CRM-231)
router.post('/:id/send-email', leadEmailsController.sendLeadEmail);
router.get('/:id/emails', leadEmailsController.listLeadEmails);

// Reasignar (solo admin/superadmin)
router.patch('/:id/reassign', roleGuard('admin', 'superadmin'), leadController.reassign);

// Reportes de spam: cualquier usuario autenticado puede reportar
router.post('/:id/report-spam', spamReportController.reportSpam);

// Soft delete / restore: SOLO superadmin (audit trail importante).
router.delete('/:id', roleGuard('superadmin'), leadController.softDelete);
router.patch('/:id/restore', roleGuard('superadmin'), leadController.restore);

// Asignar pendientes: re-aplica round-robin a leads con responsable_id IS NULL.
// Útil cuando llegan leads sin gestores activos y luego se activan.
router.post('/reassign-pending', roleGuard('admin', 'superadmin'), leadController.reassignPending);

export default router;
