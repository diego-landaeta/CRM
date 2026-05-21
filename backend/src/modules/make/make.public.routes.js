// Rutas PÚBLICAS de Make (sin auth de JWT — autenticadas por X-Make-Secret)
import { Router } from 'express';
import * as ctrl from './make.controller.js';

const router = Router();

router.post('/make/:slug', ctrl.receive);

export default router;
