import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as userController from './user.controller.js';

const router = Router();

// Todas las rutas requieren auth + admin o superadmin
router.use(verifyToken);
router.use(roleGuard('admin', 'superadmin'));

// GET /api/users — listar con filtros y paginacion
router.get('/', userController.list);

// GET /api/users/:id — detalle con proyectos asignados
router.get('/:id', userController.getById);

// POST /api/users — crear usuario + generar token set-password
router.post('/', userController.create);

// PATCH /api/users/:id — editar nombre, rol, proyectos
router.patch('/:id', userController.update);

// DELETE /api/users/:id — soft delete (desactivar)
router.delete('/:id', userController.deactivate);

// PATCH /api/users/:id/reactivate — reactivar usuario
router.patch('/:id/reactivate', userController.reactivate);

export default router;
