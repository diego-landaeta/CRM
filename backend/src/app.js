import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from './shared/utils/logger.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

// Modulos — cada uno exporta { prefix, router }
import authModule from './modules/auth/index.js';
import usersModule from './modules/users/index.js';
import leadsModule from './modules/leads/index.js';
import productsModule from './modules/products/index.js';
import dossiersModule from './modules/dossiers/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware global
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Registro automatico de modulos
const modules = [authModule, usersModule, leadsModule, productsModule, dossiersModule];

for (const mod of modules) {
  app.use(mod.prefix, mod.router);
  logger.info(`Modulo registrado: ${mod.prefix}`);
}

// Error handler (debe ir ultimo)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`CRM API corriendo en puerto ${PORT}`);
});

export default app;
