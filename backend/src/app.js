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
import commissionsModule from './modules/commissions/index.js';
import reportsModule from './modules/reports/index.js';
import matriculasModule from './modules/matriculas/index.js';
import emailSequencesModule from './modules/email-sequences/index.js';
import formsModule from './modules/forms/index.js';
import payrollModule from './modules/payroll/index.js';
import woocommerceModule from './modules/woocommerce/index.js';
import webhookTokensModule from './modules/webhook-tokens/index.js';
import audiencesModule from './modules/audiences/index.js';
import iaMonitorModule from './modules/ia-monitor/index.js';
import reportsIaModule from './modules/reports-ia/index.js';
import claudeChatModule from './modules/claude-chat/index.js';
import documentsModule from './modules/documents/index.js';
import installationModule from './modules/installation/index.js';
import projectChannelsModule from './modules/project-channels/index.js';
import permissionsModule from './modules/permissions/index.js';
import statusModule from './modules/status/index.js';
import { resolveActiveModules } from './bundles/manifest.js';
import { query } from './shared/config/db.js';
import { startEmailSequenceScheduler } from './jobs/emailSequenceScheduler.js';
import { startWooCommerceSyncScheduler } from './jobs/wooCommerceSyncScheduler.js';
import { startReminderScheduler } from './jobs/reminderScheduler.js';
import { startDocumentOrphanScheduler } from './jobs/documentOrphanScheduler.js';

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
// Mapeo modulo-name -> { module, name }. El nombre debe coincidir con el manifest de bundles.
const ALL_MODULES = [
  { name: 'auth', mod: authModule },
  { name: 'users', mod: usersModule },
  { name: 'leads', mod: leadsModule },
  { name: 'products', mod: productsModule },
  { name: 'dossiers', mod: dossiersModule },
  { name: 'conversions', mod: conversionsModule },
  { name: 'accounting', mod: accountingModule },
  { name: 'field-definitions', mod: fieldDefsModule },
  { name: 'credentials', mod: credentialsModule },
  { name: 'projects', mod: projectsModule },
  { name: 'accounts-payable', mod: accountsPayableModule },
  { name: 'product-categories', mod: productCategoriesModule },
  { name: 'commissions', mod: commissionsModule },
  { name: 'reports', mod: reportsModule },
  { name: 'matriculas', mod: matriculasModule },
  { name: 'email-sequences', mod: emailSequencesModule },
  { name: 'forms', mod: formsModule },
  { name: 'payroll', mod: payrollModule },
  { name: 'woocommerce', mod: woocommerceModule },
  { name: 'webhook-tokens', mod: webhookTokensModule },
  { name: 'audiences', mod: audiencesModule },
  { name: 'ia-monitor', mod: iaMonitorModule },
  { name: 'reports-ia', mod: reportsIaModule },
  { name: 'claude-chat', mod: claudeChatModule },
  { name: 'documents', mod: documentsModule },
  { name: 'project-channels', mod: projectChannelsModule },
  { name: 'permissions', mod: permissionsModule },
];

// Módulos siempre activos (fuera del sistema de bundles)
app.use(installationModule.prefix, installationModule.router);
logger.info(`Modulo registrado: ${installationModule.prefix} (siempre activo)`);
app.use(statusModule.prefix, statusModule.router);
logger.info(`Modulo registrado: ${statusModule.prefix} (siempre activo, incluye rutas publicas)`);

async function loadActiveBundles() {
  try {
    const { rows } = await query(`SELECT active_bundles FROM installation_bundles WHERE id = 1`);
    return rows[0]?.active_bundles || [];
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo leer installation_bundles, registrando todos los modulos');
    return null;  // null = registrar todos (compat)
  }
}

const activeBundles = await loadActiveBundles();
const allowedModuleNames = activeBundles ? resolveActiveModules(activeBundles) : null;

for (const { name, mod } of ALL_MODULES) {
  if (allowedModuleNames && !allowedModuleNames.has(name)) {
    logger.info(`Modulo SKIP (bundle inactivo): ${mod.prefix}`);
    continue;
  }
  app.use(mod.prefix, mod.router);
  logger.info(`Modulo registrado: ${mod.prefix}`);
}

// Error handler (debe ir ultimo)
app.use(errorHandler);

// Solo escuchar si no estamos en tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`CRM API corriendo en puerto ${PORT}`);
    startEmailSequenceScheduler();
    startWooCommerceSyncScheduler();
    startReminderScheduler();
    startDocumentOrphanScheduler();
  });
}

export default app;
