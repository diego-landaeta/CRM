import { Router } from 'express';
import { verifyToken, soloRoles } from '../../shared/middleware/auth.js';
import * as ctrl from './moodle.controller.js';

const router = Router();

// `soloRoles` y no `roleGuard`: roleGuard deja pasar a soporte, y el panel es de super
// admin y admin (mismo criterio que la gestión del MCP).
const verPanel = soloRoles('superadmin', 'admin');
// Conectar un Moodle es guardar una credencial: solo super admin, como en Configuración → Claves.
const conectarMoodle = soloRoles('superadmin');

router.use(verifyToken);

router.get('/campus', verPanel, ctrl.campus);
router.get('/cursos', verPanel, ctrl.cursos);
router.get('/categorias', verPanel, ctrl.categorias);
router.get('/cursos/:id/alumnos', verPanel, ctrl.alumnos);
router.get('/cursos/:id/estructura', verPanel, ctrl.estructura);
router.get('/cursos/:id/recursos', verPanel, ctrl.recursos);

router.post('/campus/:id/conexion', conectarMoodle, ctrl.conectar);
router.delete('/campus/:id/conexion', conectarMoodle, ctrl.desconectar);

export default router;
