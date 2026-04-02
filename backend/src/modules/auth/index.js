import { Router } from 'express';

// Placeholder — Diego: CRM-34 (login, logout, refresh)
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { module: 'auth', status: 'placeholder' } });
});

export default {
  prefix: '/api/auth',
  router,
};
