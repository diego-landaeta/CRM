import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './audience.controller.js';

const router = Router();
router.use(verifyToken);

router.post('/preview', ctrl.preview);
router.post('/export', roleGuard('admin', 'superadmin', 'soporte'), ctrl.exportCsv);
router.post('/upload-meta', roleGuard('admin', 'superadmin', 'soporte'), ctrl.uploadMeta);
router.get('/upload-meta/history', ctrl.uploadHistory);
router.get('/upload-meta/:uploadId/status', ctrl.uploadStatus);

export default router;
