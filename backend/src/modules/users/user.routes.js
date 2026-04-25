import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { uploadImage } from '../../shared/middleware/upload.js';
import * as userController from './user.controller.js';

const router = Router();

// GET avatar es publico (sin auth, para que se cargue en <img>)
router.get('/:id/avatar', userController.getAvatar);

router.use(verifyToken);

// POST/DELETE avatar: usuario puede modificar el suyo, superadmin cualquiera (logica en controller)
router.post('/:id/avatar', uploadImage, userController.uploadAvatar);
router.delete('/:id/avatar', userController.deleteAvatar);

// Resto admin/superadmin
router.use(roleGuard('admin', 'superadmin'));

router.get('/', userController.list);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.patch('/:id', userController.update);
router.delete('/:id', userController.deactivate);
router.patch('/:id/reactivate', userController.reactivate);

export default router;
