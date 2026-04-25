import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './report.controller.js';

const router = Router();
router.use(verifyToken);

router.get('/:projectId', ctrl.list);
router.get('/detail/:id', ctrl.getDetail);
router.post('/:projectId/generate', roleGuard('admin', 'superadmin', 'soporte'), ctrl.generate);
router.post('/:id/export-pdf', roleGuard('admin', 'superadmin', 'soporte'), ctrl.exportPdf);

export default router;
