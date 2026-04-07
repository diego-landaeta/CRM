import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import * as authController from './auth.controller.js';

const router = Router();

// POST /api/auth/login — email + password → accessToken + refreshToken cookie
router.post('/login', authController.login);

// POST /api/auth/refresh — refreshToken cookie → nuevo accessToken + rotacion cookie
router.post('/refresh', authController.refresh);

// POST /api/auth/logout — revoca refreshToken + limpia cookie
router.post('/logout', verifyToken, authController.logout);

// POST /api/auth/set-password — token unico → establecer contrasena
router.post('/set-password', authController.setPassword);

// GET /api/auth/me — datos del usuario autenticado + proyectos
router.get('/me', verifyToken, authController.me);

export default router;
