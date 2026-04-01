# 02 - Estructura del Proyecto

> Documento de arquitectura detallada del CRM MultiProyecto.  
> Stack: **React + Node.js/Express + PostgreSQL**

---

## 1. Estructura de carpetas completa

El proyecto sigue una estructura de monorepo simple con dos paquetes principales (`backend` y `frontend`) y carpetas auxiliares en la raiz.

```
crm/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                  # Pool de conexiones PostgreSQL (pg.Pool)
│   │   │   ├── r2.js                  # Cliente AWS SDK S3 configurado para Cloudflare R2
│   │   │   ├── brevo.js               # Instancia del SDK de Brevo (ex-Sendinblue)
│   │   │   └── env.js                 # Validacion de variables de entorno con Zod
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js                # verifyToken - valida JWT del header Authorization
│   │   │   ├── roleGuard.js           # Restringe acceso segun rol del usuario (admin, manager, closer)
│   │   │   ├── projectAccess.js       # Valida que el usuario tenga acceso al proyecto solicitado
│   │   │   ├── errorHandler.js        # Middleware global de errores (captura AppError y errores inesperados)
│   │   │   └── cors.js                # Configuracion de CORS por entorno
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.js         # /api/auth - login, refresh, logout, set-password
│   │   │   ├── users.routes.js        # /api/users - CRUD usuarios, asignacion a proyectos
│   │   │   ├── leads.routes.js        # /api/leads - CRUD leads, timeline, asignacion, busqueda
│   │   │   ├── products.routes.js     # /api/products - CRUD productos/servicios por proyecto
│   │   │   ├── conversions.routes.js  # /api/conversions - registro y detalle de conversiones
│   │   │   ├── dashboard.routes.js    # /api/dashboard - metricas agregadas, KPIs
│   │   │   ├── meta.routes.js         # /api/meta - campanas y metricas de Meta Ads
│   │   │   ├── google.routes.js       # /api/google - campanas y metricas de Google Ads
│   │   │   ├── gsc.routes.js          # /api/gsc - datos de Google Search Console
│   │   │   ├── stripe.routes.js       # /api/stripe - pagos, suscripciones, metricas
│   │   │   ├── audiences.routes.js    # /api/audiences - gestion de audiencias para ads
│   │   │   ├── reports.routes.js      # /api/reports - informes generados por IA
│   │   │   ├── claude.routes.js       # /api/claude - interaccion con Claude API (chat, analisis)
│   │   │   ├── admin.routes.js        # /api/admin - gestion de proyectos, credenciales, logs
│   │   │   └── webhooks.routes.js     # /api/webhooks - recepcion de webhooks externos (Meta, Stripe)
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── users.controller.js
│   │   │   ├── leads.controller.js
│   │   │   ├── products.controller.js
│   │   │   ├── conversions.controller.js
│   │   │   ├── dashboard.controller.js
│   │   │   ├── meta.controller.js
│   │   │   ├── google.controller.js
│   │   │   ├── gsc.controller.js
│   │   │   ├── stripe.controller.js
│   │   │   ├── audiences.controller.js
│   │   │   ├── reports.controller.js
│   │   │   ├── claude.controller.js
│   │   │   ├── admin.controller.js
│   │   │   └── webhooks.controller.js
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.js        # Login, tokens, refresh, hashing de passwords
│   │   │   ├── users.service.js       # Logica de usuarios: crear, actualizar, desactivar
│   │   │   ├── leads.service.js       # Logica de leads: crear, actualizar, timeline, filtros
│   │   │   ├── roundRobin.service.js  # Asignacion automatica de leads por round-robin
│   │   │   ├── brevo.service.js       # Envio de emails transaccionales y notificaciones
│   │   │   ├── products.service.js    # Logica de productos/servicios
│   │   │   ├── dossiers.service.js    # Generacion y gestion de dossiers PDF
│   │   │   ├── conversions.service.js # Registro de conversiones, calculo de comisiones
│   │   │   ├── utmParser.service.js   # Extraccion y normalizacion de parametros UTM
│   │   │   ├── dashboard.service.js   # Agregacion de metricas para dashboard
│   │   │   ├── meta.service.js        # Integracion con Meta Marketing API
│   │   │   ├── google.service.js      # Integracion con Google Ads API
│   │   │   ├── gsc.service.js         # Integracion con Google Search Console API
│   │   │   ├── stripe.service.js      # Integracion con Stripe API
│   │   │   ├── audiences.service.js   # Logica de audiencias (sync con plataformas)
│   │   │   ├── reports.service.js     # Generacion de informes periodicos
│   │   │   └── claude.service.js      # Comunicacion con Claude API para analisis e IA
│   │   │
│   │   ├── models/
│   │   │   ├── user.model.js          # Queries: findById, findByEmail, create, update, listByProject
│   │   │   ├── lead.model.js          # Queries: findById, search, create, update, getTimeline
│   │   │   ├── product.model.js       # Queries: findById, listByProject, create, update
│   │   │   ├── conversion.model.js    # Queries: findById, listByProject, create, getStats
│   │   │   ├── project.model.js       # Queries: findById, list, create, update, getMembers
│   │   │   ├── campaign.model.js      # Queries: upsertMeta, upsertGoogle, getByProject
│   │   │   ├── audience.model.js      # Queries: findById, listByProject, create, sync
│   │   │   ├── report.model.js        # Queries: findById, listByProject, create, updateContent
│   │   │   ├── credential.model.js    # Queries: getByProject, upsert (datos cifrados AES-256)
│   │   │   └── activityLog.model.js   # Queries: create, listByProject, listByUser
│   │   │
│   │   ├── jobs/
│   │   │   ├── daily-reminders.js     # Recordatorios de seguimiento pendientes (via Brevo)
│   │   │   ├── daily-meta-sync.js     # Sincronizacion diaria de metricas de Meta Ads
│   │   │   ├── daily-google-sync.js   # Sincronizacion diaria de metricas de Google Ads
│   │   │   ├── daily-gsc-sync.js      # Sincronizacion diaria de datos de Search Console
│   │   │   ├── daily-stripe-sync.js   # Sincronizacion diaria de pagos y suscripciones Stripe
│   │   │   ├── monthly-report.js      # Generacion automatica de informe mensual con IA
│   │   │   └── daily-payment-alerts.js # Alertas de pagos fallidos o vencimientos proximos
│   │   │
│   │   ├── utils/
│   │   │   ├── utmParser.js           # Parseo de query strings con parametros UTM
│   │   │   ├── hashSha256.js          # Hash SHA-256 para CAPI (Conversions API)
│   │   │   ├── presignedUrl.js        # Generacion de URLs pre-firmadas para R2
│   │   │   ├── logger.js              # Instancia de Pino configurada por entorno
│   │   │   ├── encryption.js          # AES-256-GCM para cifrar/descifrar credenciales de APIs
│   │   │   └── AppError.js            # Clase de error personalizada con statusCode
│   │   │
│   │   ├── validations/
│   │   │   ├── auth.schema.js         # Schemas: loginSchema, refreshSchema, setPasswordSchema
│   │   │   ├── lead.schema.js         # Schemas: createLeadSchema, updateLeadSchema, searchLeadSchema
│   │   │   ├── user.schema.js         # Schemas: createUserSchema, updateUserSchema
│   │   │   ├── conversion.schema.js   # Schemas: createConversionSchema, updateConversionSchema
│   │   │   ├── product.schema.js      # Schemas: createProductSchema, updateProductSchema
│   │   │   └── common.schema.js       # Schemas reutilizables: paginationSchema, idParamSchema
│   │   │
│   │   └── app.js                     # Setup de Express: middleware global, montaje de rutas, error handler
│   │
│   ├── migrations/
│   │   ├── 001_initial_schema.sql     # Tablas base: users, projects, leads, products, conversions, etc.
│   │   └── 002_phase2_schema.sql      # Tablas adicionales: campaigns, audiences, reports, credentials, etc.
│   │
│   ├── seeds/
│   │   └── 001_seed_data.sql          # Datos iniciales: usuario admin, proyecto demo, productos ejemplo
│   │
│   ├── tests/                         # Tests con Vitest, estructura espejo de src/
│   │   ├── services/
│   │   ├── controllers/
│   │   ├── models/
│   │   └── utils/
│   │
│   ├── ecosystem.config.js            # Configuracion de PM2 (instancias, logs, restart policy)
│   ├── package.json
│   └── .env.example                   # Plantilla de variables de entorno requeridas
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js              # Instancia Axios con interceptors (token, refresh, base URL)
│   │   │   ├── auth.api.js            # login(), refresh(), logout(), setPassword()
│   │   │   ├── leads.api.js           # getLeads(), getLead(), createLead(), updateLead()
│   │   │   ├── users.api.js           # getUsers(), getUser(), createUser(), updateUser()
│   │   │   ├── products.api.js        # getProducts(), createProduct(), updateProduct()
│   │   │   ├── conversions.api.js     # getConversions(), createConversion(), getConversionStats()
│   │   │   ├── dashboard.api.js       # getDashboardMetrics(), getDashboardCharts()
│   │   │   ├── campaigns.api.js       # getMetaCampaigns(), getGoogleCampaigns(), getGSCData()
│   │   │   ├── reports.api.js         # getReports(), getReport(), generateReport()
│   │   │   └── admin.api.js           # getProjects(), createProject(), getCredentials(), getLogs()
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # Componentes shadcn/ui (Radix UI + Tailwind)
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Select.jsx
│   │   │   │   ├── Dialog.jsx
│   │   │   │   ├── AlertDialog.jsx
│   │   │   │   ├── Table.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Tabs.jsx
│   │   │   │   ├── DropdownMenu.jsx
│   │   │   │   ├── Toast.jsx          # Sonner para notificaciones
│   │   │   │   ├── Skeleton.jsx
│   │   │   │   ├── Avatar.jsx
│   │   │   │   ├── Tooltip.jsx
│   │   │   │   ├── Command.jsx
│   │   │   │   ├── Calendar.jsx
│   │   │   │   ├── Sheet.jsx
│   │   │   │   └── Separator.jsx
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx      # Layout principal: sidebar + navbar + contenido
│   │   │   │   ├── AuthLayout.jsx     # Layout de autenticacion (centrado, sin sidebar)
│   │   │   │   ├── Sidebar.jsx        # Navegacion lateral con enlaces por seccion
│   │   │   │   ├── Navbar.jsx         # Barra superior: usuario, proyecto activo, logout
│   │   │   │   └── ProjectSelector.jsx # Selector de proyecto activo (dropdown)
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── StatusBadge.jsx    # Badge con color segun estado del lead
│   │   │       ├── ChannelBadge.jsx   # Badge con icono segun canal de adquisicion
│   │   │       ├── LeadCard.jsx       # Tarjeta resumen de un lead (nombre, estado, fuente)
│   │   │       ├── TimelineItem.jsx   # Elemento individual del timeline de un lead
│   │   │       ├── FilterBar.jsx      # Barra de filtros reutilizable (estado, canal, fecha)
│   │   │       ├── StatCard.jsx       # Tarjeta de metrica con titulo, valor e icono
│   │   │       ├── DataTable.jsx      # Tabla generica con paginacion y ordenamiento
│   │   │       ├── EmptyState.jsx     # Placeholder cuando no hay datos
│   │   │       ├── ConfirmDialog.jsx  # Dialogo de confirmacion reutilizable
│   │   │       ├── FileUpload.jsx     # Componente de carga de archivos (para R2)
│   │   │       ├── MarkdownRenderer.jsx # Renderizado de Markdown (para informes IA)
│   │   │       └── LoadingSpinner.jsx # Indicador de carga
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx          # Formulario de login
│   │   │   ├── SetPasswordPage.jsx    # Establecer contrasena (primer acceso o reset)
│   │   │   ├── DashboardPage.jsx      # Panel principal con KPIs y graficos
│   │   │   ├── LeadsListPage.jsx      # Listado de leads con filtros y busqueda
│   │   │   ├── LeadDetailPage.jsx     # Detalle de lead: info, timeline, acciones
│   │   │   ├── ConversionsPage.jsx    # Listado de conversiones por proyecto
│   │   │   ├── ConversionDetailPage.jsx # Detalle de conversion individual
│   │   │   ├── ProductsPage.jsx       # Gestion de productos/servicios
│   │   │   ├── MetaCampaignsPage.jsx  # Metricas de campanas de Meta Ads
│   │   │   ├── GoogleCampaignsPage.jsx # Metricas de campanas de Google Ads
│   │   │   ├── GSCPage.jsx            # Datos de Google Search Console
│   │   │   ├── IAMonitorPage.jsx      # Monitor de uso y costes de IA
│   │   │   ├── AudiencesPage.jsx      # Gestion de audiencias
│   │   │   ├── ReportsListPage.jsx    # Listado de informes generados
│   │   │   ├── ReportDetailPage.jsx   # Detalle de un informe (Markdown renderizado)
│   │   │   ├── ChatPage.jsx           # Chat interactivo con IA (Claude)
│   │   │   ├── UsersAdminPage.jsx     # Administracion de usuarios
│   │   │   ├── UserDetailPage.jsx     # Detalle y edicion de un usuario
│   │   │   ├── ProjectsAdminPage.jsx  # Administracion de proyectos
│   │   │   ├── CredentialsPage.jsx    # Gestion de credenciales de APIs por proyecto
│   │   │   ├── ActivityLogPage.jsx    # Log de actividad del sistema
│   │   │   ├── QueueConfigPage.jsx    # Configuracion de cola round-robin
│   │   │   └── NotFoundPage.jsx       # Pagina 404
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js             # Acceso al AuthContext (user, login, logout, isAuthenticated)
│   │   │   ├── useProject.js          # Acceso al ProjectContext (project, setProject, projects)
│   │   │   ├── useLeads.js            # Hook para cargar y filtrar leads
│   │   │   ├── usePagination.js       # Hook para manejar estado de paginacion
│   │   │   ├── useDebounce.js         # Hook para debounce de valores (busqueda)
│   │   │   └── useLocalStorage.js     # Hook para persistencia en localStorage
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx        # Estado global de autenticacion (user, tokens)
│   │   │   └── ProjectContext.jsx     # Estado global del proyecto activo
│   │   │
│   │   ├── lib/
│   │   │   ├── utils.js               # Helper cn() para merge de clases Tailwind (clsx + tailwind-merge)
│   │   │   ├── constants.js           # Colores de estados, etiquetas de canales, roles
│   │   │   └── formatters.js          # Formateo de moneda, fechas, porcentajes
│   │   │
│   │   ├── router.jsx                 # React Router v6: rutas con lazy imports y guards de autenticacion
│   │   └── main.jsx                   # Punto de entrada: monta providers (Auth, Project, Router)
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   │
│   ├── index.html                     # HTML base para Vite
│   ├── tailwind.config.js             # Configuracion de Tailwind (colores custom, fonts)
│   ├── postcss.config.js              # PostCSS con Tailwind y Autoprefixer
│   ├── vite.config.js                 # Vite config: base '/crm/' para sub-path en Nginx
│   └── package.json
│
├── docs/                              # Documentacion del proyecto en Markdown
│   ├── 01-vision-general.md
│   ├── 02-estructura-proyecto.md      # (este archivo)
│   └── ...
│
├── nginx/
│   └── crm.conf                       # Template de configuracion Nginx (proxy + SPA)
│
├── scripts/
│   ├── backup.sh                      # Script de backup de la base de datos
│   └── deploy.sh                      # Script de despliegue automatizado
│
├── .gitignore                         # node_modules, .env, dist, logs
├── CLAUDE.md                          # Instrucciones para Claude Code
└── README.md                          # Descripcion general y guia de inicio rapido
```

---

## 2. Patrones y convenciones

### 2.1 Flujo de una peticion (backend)

Cada peticion HTTP sigue un flujo lineal y predecible a traves de las siguientes capas:

```
Cliente (Browser)
    │
    ▼
Nginx (reverse proxy, sirve SPA en /crm, proxy /api → Express)
    │
    ▼
Express (app.js)
    │
    ▼
Route (define endpoints y encadena middleware)
    │
    ▼
Middleware (auth → roleGuard → projectAccess)
    │
    ▼
Controller (capa fina: valida entrada, llama al service, responde)
    │
    ▼
Service (logica de negocio: orquesta models, integraciones externas)
    │
    ▼
Model (funciones SQL puras contra PostgreSQL via pg pool)
    │
    ▼
PostgreSQL
```

**Reglas de cada capa:**

| Capa           | Responsabilidad                                                  | NO debe hacer                        |
| -------------- | ---------------------------------------------------------------- | ------------------------------------ |
| **Route**      | Definir método HTTP, path y middleware encadenados                | Contener logica de negocio           |
| **Middleware**  | Verificar tokens, roles, acceso a proyecto, parsear datos        | Acceder a la base de datos           |
| **Controller** | Validar input (Zod), llamar al service, formatear respuesta HTTP | Contener logica de negocio compleja  |
| **Service**    | Implementar reglas de negocio, orquestar modelos e integraciones | Conocer detalles HTTP (req, res)     |
| **Model**      | Ejecutar queries SQL parametrizadas                              | Contener logica de negocio           |

### 2.2 Sin ORM: SQL directo con `pg`

No se utiliza ningun ORM (Sequelize, Prisma, Drizzle, etc.). Los modelos son archivos JavaScript planos que exportan funciones. Cada funcion ejecuta una query SQL parametrizada usando el pool de conexiones de `pg`.

**Patron de un archivo model:**

```js
// src/models/lead.model.js
import { pool } from '../config/db.js';

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT l.*, u.name AS assigned_to_name
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_to
     WHERE l.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function search({ projectId, status, channel, query, limit, offset }) {
  const conditions = ['l.project_id = $1'];
  const params = [projectId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`l.status = $${paramIndex++}`);
    params.push(status);
  }
  if (channel) {
    conditions.push(`l.channel = $${paramIndex++}`);
    params.push(channel);
  }
  if (query) {
    conditions.push(`(l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex})`);
    params.push(`%${query}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM leads l WHERE ${where}`,
    params
  );

  const { rows } = await pool.query(
    `SELECT l.*, u.name AS assigned_to_name
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_to
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    data: rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}

export async function create({ projectId, name, email, phone, channel, source, utmData }) {
  const { rows } = await pool.query(
    `INSERT INTO leads (project_id, name, email, phone, channel, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [projectId, name, email, phone, channel, source,
     utmData?.source, utmData?.medium, utmData?.campaign, utmData?.content, utmData?.term]
  );
  return rows[0];
}

export async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}
```

**Ventajas de este enfoque:**
- Control total sobre las queries (JOINs, subqueries, CTEs, window functions).
- Facil de optimizar: se puede usar `EXPLAIN ANALYZE` directamente.
- Sin capas de abstraccion ni magia oculta.
- Sin overhead de build/generacion de tipos.

### 2.3 Manejo de errores

Se utiliza una clase `AppError` personalizada que extiende `Error` y anade un `statusCode`. Esto permite lanzar errores semanticos desde cualquier capa y que el middleware global los capture.

**Clase AppError:**

```js
// src/utils/AppError.js
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Middleware global de errores:**

```js
// src/middleware/errorHandler.js
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  // Si es un error operacional (AppError), enviar el mensaje al cliente
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Error inesperado: loguear detalle, enviar mensaje generico
  logger.error({ err, url: req.originalUrl, method: req.method }, 'Error inesperado');

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
```

**Uso en un service:**

```js
// src/services/leads.service.js
import { AppError } from '../utils/AppError.js';
import * as LeadModel from '../models/lead.model.js';

export async function getLeadById(id, projectId) {
  const lead = await LeadModel.findById(id);

  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }
  if (lead.project_id !== projectId) {
    throw new AppError('No tienes acceso a este lead', 403);
  }

  return lead;
}
```

### 2.4 Validacion con Zod

Toda la validacion de datos de entrada (`req.body`, `req.query`, `req.params`) se realiza en la capa del controller usando schemas de Zod. Si la validacion falla, se lanza un `AppError` con codigo 400.

**Ejemplo de schema:**

```js
// src/validations/lead.schema.js
import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200),
  email: z.string().email('Email invalido').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  channel: z.enum(['meta', 'google', 'organic', 'referral', 'manual', 'other']),
  source: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const searchLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']).optional(),
  channel: z.enum(['meta', 'google', 'organic', 'referral', 'manual', 'other']).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

**Uso en controller:**

```js
// src/controllers/leads.controller.js
import { createLeadSchema, searchLeadSchema } from '../validations/lead.schema.js';
import * as LeadsService from '../services/leads.service.js';
import { AppError } from '../utils/AppError.js';

export async function createLead(req, res, next) {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const lead = await LeadsService.createLead({
      ...parsed.data,
      projectId: req.projectId,
    });

    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function searchLeads(req, res, next) {
  try {
    const parsed = searchLeadSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { page, limit, ...filters } = parsed.data;
    const offset = (page - 1) * limit;

    const result = await LeadsService.searchLeads({
      projectId: req.projectId,
      ...filters,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}
```

### 2.5 Frontend: paginas autocontenidas

Cada pagina es un componente React autocontenido que gestiona su propio ciclo de vida de datos:

1. **Carga:** Usa `useEffect` + funcion de la capa `api/` para obtener datos.
2. **Estado local:** `useState` para datos, loading, errores y filtros.
3. **Contextos globales:** Solo `useAuth()` (usuario autenticado) y `useProject()` (proyecto activo).
4. **Sin cache global:** Con 1-5 usuarios concurrentes, no se necesita cache sofisticado. Si la escala lo requiere en el futuro, se puede anadir TanStack Query sin cambiar la estructura.

**Patron tipico de una pagina:**

```jsx
// src/pages/LeadsListPage.jsx
import { useState, useEffect } from 'react';
import { useProject } from '../hooks/useProject';
import { getLeads } from '../api/leads.api';
import { DataTable } from '../components/shared/DataTable';
import { FilterBar } from '../components/shared/FilterBar';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';

export default function LeadsListPage() {
  const { project } = useProject();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [filters, setFilters] = useState({});

  useEffect(() => {
    if (!project) return;

    setLoading(true);
    getLeads(project.id, { ...filters, page: pagination.page })
      .then(({ data, pagination: pag }) => {
        setLeads(data);
        setPagination(prev => ({ ...prev, total: pag.total }));
      })
      .finally(() => setLoading(false));
  }, [project, filters, pagination.page]);

  if (loading) return <LoadingSpinner />;
  if (!leads.length) return <EmptyState message="No hay leads todavia" />;

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />
      <DataTable data={leads} pagination={pagination} onPageChange={/* ... */} />
    </div>
  );
}
```

### 2.6 Flujo de autenticacion

El flujo de autenticacion sigue el patron de **access token + refresh token en cookie httpOnly**:

```
1. Login (POST /api/auth/login)
   ├── Valida email + password (bcryptjs)
   ├── Genera accessToken (JWT, vida corta: 15 min)
   ├── Genera refreshToken (JWT, vida larga: 7 dias)
   ├── Envia accessToken en JSON body
   └── Envia refreshToken en cookie httpOnly (secure, sameSite: strict)

2. Peticiones autenticadas
   ├── Axios anade header: Authorization: Bearer <accessToken>
   └── Backend middleware (auth.js) verifica el JWT

3. Token expirado (401)
   ├── Axios interceptor detecta 401
   ├── Llama POST /api/auth/refresh (cookie se envia automaticamente)
   ├── Recibe nuevo accessToken
   ├── Reintenta la peticion original con el nuevo token
   └── Si refresh falla → redirect a /login (sesion expirada)

4. Logout (POST /api/auth/logout)
   ├── Backend invalida el refresh token en BD
   └── Frontend limpia estado (AuthContext) y redirige a /login
```

**Interceptor de Axios:**

```js
// src/api/client.js
import axios from 'axios';

const client = axios.create({
  baseURL: '/crm/api',
  withCredentials: true, // Envia cookies httpOnly
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token);
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/crm/api/auth/refresh', {}, { withCredentials: true });
        const newToken = data.accessToken;
        client.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.location.href = '/crm/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
```

---

## 3. Dependencias principales (packages)

### 3.1 Backend

| Paquete                                | Proposito                                                         |
| -------------------------------------- | ----------------------------------------------------------------- |
| `express`                              | Framework HTTP principal                                          |
| `cors`                                 | Manejo de Cross-Origin Resource Sharing                           |
| `helmet`                               | Headers de seguridad HTTP                                         |
| `compression`                          | Compresion gzip de respuestas                                     |
| `cookie-parser`                        | Parseo de cookies (refresh token httpOnly)                        |
| `pg`                                   | Cliente PostgreSQL (pool de conexiones)                           |
| `jsonwebtoken`                         | Generacion y verificacion de JWT (access y refresh tokens)        |
| `bcryptjs`                             | Hashing de passwords                                              |
| `zod`                                  | Validacion de schemas de datos de entrada                         |
| `@aws-sdk/client-s3`                   | Cliente S3 para Cloudflare R2 (subida de archivos)                |
| `@aws-sdk/s3-request-presigner`        | Generacion de URLs pre-firmadas para descarga desde R2            |
| `sib-api-v3-sdk`                       | SDK de Brevo (ex-Sendinblue) para emails transaccionales          |
| `node-cron`                            | Programacion de tareas cron (sincronizaciones diarias, informes)  |
| `pino`                                 | Logger estructurado de alto rendimiento (JSON)                    |
| `pino-pretty`                          | Formateo legible de logs de Pino (solo en desarrollo)             |
| `dotenv`                               | Carga de variables de entorno desde archivo .env                  |
| `crypto` (built-in)                    | AES-256-GCM para cifrar credenciales de APIs en la base de datos  |
| `uuid`                                 | Generacion de identificadores unicos universales                  |

**Dev dependencies:**

| Paquete    | Proposito                                            |
| ---------- | ---------------------------------------------------- |
| `nodemon`  | Reinicio automatico del server en desarrollo         |
| `vitest`   | Framework de testing (compatible con Jest, mas rapido)|

### 3.2 Frontend

| Paquete                          | Proposito                                                       |
| -------------------------------- | --------------------------------------------------------------- |
| `react`                          | Libreria de UI                                                  |
| `react-dom`                      | Renderizado en el DOM                                           |
| `react-router-dom`               | Enrutamiento SPA (v6, con lazy loading)                         |
| `@radix-ui/*`                    | Primitivas de UI accesibles (via shadcn/ui)                     |
| `tailwindcss`                    | Framework CSS utility-first                                     |
| `postcss`                        | Procesador CSS (requerido por Tailwind)                         |
| `autoprefixer`                   | Prefijos CSS automaticos para compatibilidad                    |
| `class-variance-authority`       | Variantes de estilo para componentes (dependencia de shadcn/ui) |
| `clsx`                           | Merge condicional de clases CSS                                 |
| `tailwind-merge`                 | Resolucion de conflictos de clases Tailwind                     |
| `axios`                          | Cliente HTTP con interceptors                                   |
| `recharts`                       | Graficos y charts para dashboard (basado en D3)                 |
| `lucide-react`                   | Iconos SVG (reemplazo moderno de Feather Icons)                 |
| `react-markdown`                 | Renderizado de Markdown (para informes generados por IA)        |
| `date-fns`                       | Utilidades de formateo y manipulacion de fechas                 |

**Dev dependencies:**

| Paquete                  | Proposito                                        |
| ------------------------ | ------------------------------------------------ |
| `vite`                   | Build tool y dev server (rapido, ESM nativo)     |
| `@vitejs/plugin-react`   | Plugin de Vite para React (JSX, Fast Refresh)    |

---

## 4. Decisiones tecnicas clave

### 4.1 Sin TypeScript

**Decision:** JavaScript ES modules (`"type": "module"` en package.json).

**Justificacion:**
- El proyecto es pequeno y sera usado por 1-5 usuarios concurrentes.
- TypeScript anade complejidad de compilacion (build step, source maps, tsconfig) sin beneficio proporcional a esta escala.
- La validacion en runtime con Zod cubre la entrada de datos de forma explicita y con mensajes claros.
- Si el proyecto crece significativamente, se puede migrar incrementalmente a TypeScript anadiendo JSDoc types o migrando archivo por archivo.

### 4.2 Sin ORM

**Decision:** SQL directo con la libreria `pg` y funciones exportadas por modelo.

**Justificacion:**
- Control total sobre las queries. Se pueden escribir JOINs complejos, CTEs, window functions y subqueries sin luchar contra abstracciones.
- Facil de optimizar: `EXPLAIN ANALYZE` directo sobre las queries reales, sin capas intermedias que generen SQL impredecible.
- Sin overhead de generacion de tipos, migraciones propietarias o configuraciones adicionales.
- El equipo escribe SQL directamente, lo cual es una habilidad transferible y transparente.
- Las queries parametrizadas (`$1`, `$2`, ...) de `pg` protegen contra SQL injection de forma nativa.

### 4.3 Sin Redux ni state manager externo

**Decision:** React Context API con dos contextos globales (`AuthContext` + `ProjectContext`).

**Justificacion:**
- Con 1-5 usuarios concurrentes, no hay necesidad de cache global sofisticado ni gestion de estado compleja.
- `AuthContext` gestiona: usuario autenticado, tokens, funciones de login/logout.
- `ProjectContext` gestiona: proyecto activo, lista de proyectos del usuario.
- Cada pagina carga sus propios datos via hooks/api. No hay datos compartidos complejos entre paginas.
- Si en el futuro se necesita cache de datos del servidor (invalidacion, revalidacion, optimistic updates), se puede incorporar **TanStack Query** sin cambiar la estructura existente de paginas ni de la capa API.

### 4.4 Sin herramientas de monorepo (Nx, Turborepo)

**Decision:** Carpetas `backend/` y `frontend/` independientes, cada una con su propio `package.json`. Opcionalmente, npm workspaces en la raiz.

**Justificacion:**
- El proyecto tiene solo dos paquetes. No hay librerias compartidas ni generacion de codigo cruzada.
- Nx o Turborepo anaden configuracion, curva de aprendizaje y dependencias sin beneficio real a esta escala.
- `npm install` en cada carpeta es suficiente. Los scripts de deploy (`scripts/deploy.sh`) manejan ambos paquetes de forma secuencial.

### 4.5 Vite con `base: '/crm/'`

**Decision:** Configurar `base: '/crm/'` en `vite.config.js` para que el SPA se sirva en un sub-path.

**Justificacion:**
- El servidor (VPS) aloja el CRM bajo la ruta `/crm` mediante Nginx, no en la raiz del dominio.
- Nginx sirve los archivos estaticos del frontend desde `/crm/` y proxea las peticiones API desde `/crm/api/` al backend Express.
- Sin `base: '/crm/'`, todos los assets (JS, CSS, imagenes) intentarian cargarse desde `/` en lugar de `/crm/`, rompiendo la aplicacion.
- React Router tambien se configura con `basename="/crm"` para que las rutas coincidan.

**Configuracion relevante:**

```js
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/crm/',
  server: {
    proxy: {
      '/crm/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/crm/, ''),
      },
    },
  },
});
```

```js
// frontend/src/router.jsx
import { createBrowserRouter } from 'react-router-dom';

const router = createBrowserRouter(
  [
    // ... rutas
  ],
  { basename: '/crm' }
);
```

---

## Resumen visual de la arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      NAVEGADOR                          │
│  React SPA (Vite + React Router + shadcn/ui + Axios)    │
│  Servido desde /crm/ via Nginx                          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      NGINX                              │
│  /crm/        → archivos estaticos (dist/)              │
│  /crm/api/*   → proxy_pass http://localhost:3000/api/*  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (interno)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                EXPRESS (Node.js)                         │
│  Middleware: cors → helmet → compression → auth → roles │
│  Routes → Controllers → Services → Models               │
│  Jobs (node-cron): sync diario, reportes, alertas       │
└──────────┬──────────┬──────────┬───────────────────────┘
           │          │          │
           ▼          ▼          ▼
┌──────────────┐ ┌─────────┐ ┌──────────────────────────┐
│  PostgreSQL  │ │   R2    │ │   APIs externas          │
│  (pg pool)   │ │  (S3)   │ │  Meta, Google, Stripe,   │
│              │ │         │ │  Brevo, Claude, GSC      │
└──────────────┘ └─────────┘ └──────────────────────────┘
```
