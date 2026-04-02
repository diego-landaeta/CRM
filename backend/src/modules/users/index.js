import { Router } from 'express';

// Placeholder — Diego: CRM-37 (CRUD usuarios + bienvenida Brevo)
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { module: 'users', status: 'placeholder' } });
});

export default {
  prefix: '/api/users',
  router,
};
