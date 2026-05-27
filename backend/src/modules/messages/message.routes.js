import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import * as ctrl from './message.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/conversations', ctrl.listConversations);
router.get('/conversations/unread-count', ctrl.unreadCount);
router.post('/conversations', ctrl.createConversation);
router.get('/conversations/:id/messages', ctrl.listMessages);
router.post('/conversations/:id/messages', ctrl.sendMessage);
router.patch('/conversations/:id/read', ctrl.markRead);
router.post('/conversations/:id/typing', ctrl.typing);
router.get('/conversations/:id/typing', ctrl.getTyping);
router.delete('/messages/:msgId', ctrl.deleteMessage);
router.get('/users/available', ctrl.availableUsers);
router.get('/users/online', ctrl.onlineUsers);

export default router;
