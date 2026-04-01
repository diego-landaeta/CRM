# CRM MultiProyecto — Guia de Desarrollo

## Descripcion
CRM interno multi-proyecto para gestion de leads, conversiones, campanas publicitarias y monitorizacion de ingresos. Proyectos educativos (Psiko Aprende, ISEIH, Fono Aprende) y plataformas IA (Psicologo IA, Nutricionista IA, Tarot IA).

## Stack
- **Frontend:** React 18 + Vite + shadcn/ui (Radix + Tailwind) — SPA servida desde /crm en Nginx
- **Backend:** Node.js + Express — API REST en puerto 3001, proxy reverso Nginx
- **Base de datos:** PostgreSQL — Relacional, multi-proyecto con FK en todas las entidades
- **Servidor:** VPS Hostinger (KVM) — Nginx + PM2 + Let's Encrypt (HTTPS)
- **Storage:** Cloudflare R2 — Compatible S3, dossiers PDF
- **Email:** Brevo — Notificaciones leads + bienvenida usuarios
- **APIs externas:** Meta Marketing API v19+, Google Ads API v16+, GSC API, Stripe, Claude AI

## Estructura del repositorio
```
backend/
  src/
    config/           # db.js, r2.js, brevo.js, validacion de env
    middleware/        # auth.js, roleGuard.js, projectAccess.js, errorHandler.js
    routes/           # auth.routes.js, users.routes.js, leads.routes.js, ...
    controllers/      # auth.controller.js, users.controller.js, ...
    services/         # auth.service.js, leads.service.js, roundRobin.service.js, ...
    models/           # Queries SQL directas con pg pool (NO ORM)
    jobs/             # Cron jobs: reminders, metaSync, googleSync, ...
    utils/            # utmParser.js, hashSha256.js, presignedUrl.js, logger.js
    validations/      # Schemas Zod por entidad
    app.js            # Setup Express
  migrations/         # SQL secuencial: 001_initial_schema.sql, ...
  seeds/              # Seed data SQL
  tests/              # Tests con Vitest
  ecosystem.config.js # PM2
  package.json
  .env.example

frontend/
  src/
    api/              # Axios instance + funciones por dominio
    components/
      ui/             # Primitivas shadcn/ui (Button, Input, Dialog, Table, ...)
      layout/         # AppLayout, Sidebar, Navbar, ProjectSelector
      shared/         # StatusBadge, LeadCard, TimelineItem, FilterBar, ...
    pages/            # Una por ruta: LoginPage, DashboardPage, LeadsPage, ...
    hooks/            # useAuth, useProject, useLeads, usePagination, ...
    contexts/         # AuthContext, ProjectContext
    lib/              # cn(), constantes, formateadores
    router.jsx        # React Router v6
    main.jsx
  tailwind.config.js
  vite.config.js
  package.json

docs/       # Documentacion tecnica en Markdown
nginx/      # Template configuracion Nginx
scripts/    # backup.sh, deploy.sh
```

## Convenciones de codigo

### Backend (Node.js)
- JavaScript ES modules (`import`/`export`), NO TypeScript
- Archivos en **kebab-case**: `lead.service.js`, `auth.controller.js`
- Funciones `async/await`, nunca callbacks
- Queries SQL directas con `pg` pool — **NO ORM** (ni Prisma, ni Sequelize, ni Knex)
- Validacion de input con **Zod** en cada endpoint
- Errores con clase `AppError(message, statusCode)`
- Logger: `pino` con niveles info/warn/error
- Tests con Vitest

### Frontend (React)
- Componentes en **PascalCase**: `LeadCard.jsx`, `DashboardPage.jsx`
- **shadcn/ui** para primitivas (Button, Input, Dialog, Table, Select, Badge)
- **Tailwind CSS** para estilos — nunca CSS modules ni styled-components
- Estado global: **React Context** (AuthContext, ProjectContext) — NO Redux
- Fetching: funciones en `/api/` con axios, llamadas desde hooks custom
- **React Router v6** con lazy loading por pagina
- Graficas con **Recharts**

### General
- **Idioma del codigo:** ingles para variables/funciones, espanol para comentarios si son necesarios
- **Commits en espanol** con prefijos: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- **Ramas:** `main` (produccion), `dev` (desarrollo), `feature/nombre-corto`, `hotfix/nombre`
- Variables de entorno en `.env` — NUNCA hardcodeadas
- Nunca commit de `.env`, `node_modules/`, `dist/`

## Reglas de negocio criticas

### Autenticacion
- Contraseñas con **bcrypt cost factor 12**
- JWT access token: **15 minutos** en header `Authorization: Bearer`
- Refresh token: **30 dias** en **httpOnly cookie**
- Middleware chain: `verifyToken` → `roleGuard` → `projectAccess`

### Roles
- **Superadmin**: acceso total, unico que crea/desactiva usuarios
- **Admin**: acceso operativo completo, no gestiona usuarios
- **Gestor**: solo ve proyectos asignados, solo sus leads

### Leads
- **Round-robin** en transaccion PostgreSQL (`BEGIN`/`COMMIT`), nunca fuera
- **Webhook < 500ms**: email de Brevo se envia async, respuesta inmediata al formulario
- **Duplicados**: deteccion por email, siempre crear nuevo registro + vincular con `lead_duplicado_de`
- **Gestores inactivos**: se saltan en round-robin automaticamente

### Archivos
- **Pre-signed URLs**: 15 minutos de expiracion, solo usuarios autenticados
- **Dossiers**: versionados, la anterior se marca inactiva, nunca se borra

### Seguridad
- Credenciales API **encriptadas en DB** (AES-256), configurables desde panel admin
- CORS configurado **por dominio de proyecto**, nunca wildcard
- PostgreSQL **solo acceso local** (nunca expuesto al exterior)

## Formato de respuesta API
```json
// Exito
{ "success": true, "data": { ... }, "pagination": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 } }

// Error
{ "success": false, "error": "Mensaje descriptivo", "code": "ERROR_CODE" }
```

## Comandos utiles
```bash
# Backend - desarrollo
cd backend && npm run dev          # nodemon

# Frontend - desarrollo
cd frontend && npm run dev         # vite dev server

# Migraciones
psql -U crm_user -d crm_db -f backend/migrations/001_initial_schema.sql

# Build produccion
cd frontend && npm run build

# PM2
pm2 start ecosystem.config.js
pm2 logs crm-api
pm2 restart crm-api
```

## Documentacion de referencia
- `docs/01-esquema-base-datos.md` — Schema completo PostgreSQL
- `docs/02-estructura-proyecto.md` — Arquitectura detallada
- `docs/03-api-endpoints.md` — Todos los endpoints REST
- `docs/04-variables-entorno.md` — Template .env
- `docs/05-arquitectura-frontend.md` — Rutas, layouts, componentes
- `docs/06-despliegue-devops.md` — Deploy, Nginx, PM2, backups
- `docs/07-tareas-jira.md` — Epics, stories y asignaciones
