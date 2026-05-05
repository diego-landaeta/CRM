import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { uploadImage } from '../../shared/middleware/upload.js';
import * as ctrl from './project.controller.js';
import * as shortcutsCtrl from './shortcuts.controller.js';

const router = Router();

// GET /:id/logo es publico (sin auth) para que se cargue en <img>
router.get('/:id/logo', ctrl.getLogo);

router.use(verifyToken);

// Atajos — catálogo (cualquier autenticado)
router.get('/shortcuts/catalog', shortcutsCtrl.getCatalog);

// Lectura: cualquier user autenticado
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

// Escritura: solo superadmin
router.post('/', roleGuard('superadmin'), ctrl.create);
router.patch('/:id', roleGuard('superadmin'), ctrl.update);
router.post('/:id/regenerate-webhook-key', roleGuard('superadmin'), ctrl.regenerateKey);
router.post('/:id/logo', roleGuard('admin', 'superadmin'), uploadImage, ctrl.uploadLogo);
router.delete('/:id/logo', roleGuard('admin', 'superadmin'), ctrl.deleteLogo);

// Atajos — guardar configuración (admin/superadmin)
router.put('/:id/shortcuts', roleGuard('admin', 'superadmin'), shortcutsCtrl.saveShortcuts);

export default router;
