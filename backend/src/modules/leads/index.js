import { Router } from 'express';

// Placeholder — Diego: CRM-35 a CRM-43 (webhook, leads, round-robin)
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { module: 'leads', status: 'placeholder' } });
});

export default {
  prefix: '/api/leads',
  router,
};
