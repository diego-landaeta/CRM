import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import * as ctrl from './chat.controller.js';

const router = Router();
router.use(verifyToken);

router.get('/status', ctrl.status);
router.get('/conversations', ctrl.listConversations);
router.get('/conversations/:conversationId', ctrl.getMessages);
router.post('/chat', ctrl.chat);

export default router;
