import { Router } from 'express';
import { verifyToken, soloRoles } from '../../shared/middleware/auth.js';
import * as ctrl from './moodle.controller.js';

const router = Router();

// `soloRoles` y no `roleGuard`: roleGuard deja pasar a soporte, y el panel es de super
// admin y admin (mismo criterio que la gestión del MCP).
router.use(verifyToken, soloRoles('superadmin', 'admin'));

router.get('/campus', ctrl.campus);
router.get('/cursos', ctrl.cursos);
router.get('/categorias', ctrl.categorias);
router.get('/cursos/:id/alumnos', ctrl.alumnos);
router.get('/cursos/:id/estructura', ctrl.estructura);
router.get('/cursos/:id/recursos', ctrl.recursos);

export default router;
