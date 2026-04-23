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
import conversionsModule from './modules/conversions/index.js';
import accountingModule from './modules/accounting/index.js';
import fieldDefsModule from './modules/field-definitions/index.js';
import credentialsModule from './modules/credentials/index.js';
import projectsModule from './modules/projects/index.js';
import accountsPayableModule from './modules/accounts-payable/index.js';
import productCategoriesModule from './modules/product-categories/index.js';

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

// API root
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'CRM MultiProyecto API',
      version: '1.0.0',
      status: 'online',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth (login, refresh, logout, set-password, me)',
        users: '/api/users',
        leads: '/api/leads',
        products: '/api/products',
        dossiers: '/api/dossiers',
      },
    },
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Registro automatico de modulos
const modules = [authModule, usersModule, leadsModule, productsModule, dossiersModule, conversionsModule, accountingModule, fieldDefsModule, credentialsModule, projectsModule, accountsPayableModule, productCategoriesModule];

for (const mod of modules) {
  app.use(mod.prefix, mod.router);
  logger.info(`Modulo registrado: ${mod.prefix}`);
}

// Error handler (debe ir ultimo)
app.use(errorHandler);

// Solo escuchar si no estamos en tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`CRM API corriendo en puerto ${PORT}`);
  });
}

export default app;
