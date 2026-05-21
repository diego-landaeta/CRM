import router from './make.routes.js';
import publicRouter from './make.public.routes.js';

// Admin (CRUD): /api/make-webhooks/*  (requiere JWT)
// Público (ingesta): /api/webhooks/make/:slug  (X-Make-Secret)
export default {
  prefix: '/api/make-webhooks',
  router,
  // export adicional consumido por app.js para registrar las rutas públicas
  publicMount: { prefix: '/api/webhooks', router: publicRouter },
};
