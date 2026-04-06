# CRM MultiProyecto

Sistema interno de gestion de leads, conversiones, campanas publicitarias y monitorizacion de ingresos.

## Proyectos CRM
- Psiko Aprende
- ISEIH
- Fono Aprende

## Proyectos IA (monitorizacion)
- Psicologo IA
- Nutricionista IA
- Tarot IA

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| **Frontend** | React 18 + Vite + shadcn/ui + Tailwind CSS |
| **Backend** | Node.js + Express (API REST, puerto 3001) |
| **Base de datos** | PostgreSQL 17 |
| **Servidor** | VPS Hostinger — Ubuntu 25.04, Nginx + PM2 + HTTPS |
| **Storage** | Cloudflare R2 (compatible S3) |
| **Email** | Brevo (API v3) |
| **APIs externas** | Meta Marketing, Google Ads, GSC, Stripe, Claude AI |

---

## Equipo y Responsabilidades

| Persona | Rol | Area | Jira |
|---------|-----|------|------|
| **Manuel Casas** | Propietario / Superadmin | Direccion | — |
| **Diego Seo** | Desarrollador fullstack | Backend, Config, QA, DevOps | 68 stories |
| **Angel M** | Desarrollador fullstack | Frontend, UI/UX | 29 stories |

**Jira:** [seo-iseie.atlassian.net](https://seo-iseie.atlassian.net) — Proyecto `CRM`

---

## Servidor VPS

| Campo | Valor |
|-------|-------|
| **OS** | Ubuntu 25.04 (Plucky Puffin) |
| **Node.js** | v24.14.1 (LTS via nvm) |
| **PostgreSQL** | 17.7 (UTF-8) |
| **PM2** | 6.0.14 (startup systemd) |
| **Usuario deploy** | `claude` (SSH key, sudo NOPASSWD) |

> Credenciales en `Claude/fase-1/CREDENCIALES-PRIVADO.md`

### Conectar al servidor

```bash
# SSH
ssh claude@187.124.128.126

# Tunel SSH para pgAdmin (puerto 5432 bloqueado externamente)
ssh -f -N -L 15432:localhost:5432 claude@187.124.128.126
# Luego conectar pgAdmin a 127.0.0.1:15432
```

---

## Desarrollo Local

### Requisitos
- Node.js 20+ (recomendado: usar nvm)
- Git

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173/crm/
```

### Backend
```bash
cd backend
cp .env.example .env   # Configurar variables
npm install
npm run dev            # http://localhost:3001
```

### Produccion
```bash
# Build frontend
cd frontend && npm run build

# PM2 (en servidor)
pm2 start ecosystem.config.js
pm2 logs crm-api
```

---

## Estructura del Repositorio

```
backend/           API REST Node.js + Express (modular)
  src/
    modules/       Un directorio por dominio (auth, leads, products, dossiers...)
    shared/        Config, middleware, utils compartidos
  migrations/      SQL secuencial (001_, 002_...)
  seeds/           Seed data
  
frontend/          SPA React + Vite
  src/
    modules/       Un directorio por feature (leads, products, auth...)
    shared/        Componentes UI, hooks, api client
    contexts/      AuthContext, ProjectContext

Claude/            Base de conocimiento del proyecto
  fase-1/          Core CRM — tracking stories + credenciales
  fase-2/          Integraciones API externas
  fase-3/          Funcionalidades avanzadas

docs/              Documentacion tecnica
scripts/           Backup, deploy, utilidades
```

---

## Documentacion

| Doc | Contenido |
|-----|-----------|
| [Esquema DB](docs/01-esquema-base-datos.md) | Todas las tablas, relaciones, constraints |
| [Estructura proyecto](docs/02-estructura-proyecto.md) | Arquitectura modular detallada |
| [Endpoints API](docs/03-api-endpoints.md) | Todos los endpoints REST con ejemplos |
| [Variables entorno](docs/04-variables-entorno.md) | Template .env con descripcion |
| [Arquitectura frontend](docs/05-arquitectura-frontend.md) | Layouts, componentes, colores, responsive |
| [Deploy y DevOps](docs/06-despliegue-devops.md) | Nginx, PM2, backups, CI |
| [Tareas Jira](docs/07-tareas-jira.md) | 15 Epics, ~97 Stories con criterios de aceptacion |
| [CLAUDE.md](CLAUDE.md) | Guia de desarrollo y convenciones de codigo |

---

## Estado del Proyecto

### Fase 1 — Core CRM
| Epic | Stories | Done |
|------|---------|------|
| Setup Infraestructura | 8 | 3 |
| Auth + Roles + Panel Usuarios | 11 | 4 |
| Productos + Dossiers PDF | 7 | 2 |
| Webhook + UTMs + Round-robin | 11 | 3 |
| Ficha Lead + Historial | 9 | 4 |
| Conversiones y Pagos | 7 | 3 |
| Dashboard + QA | 10 | 2 |

### Fase 2 — Integraciones API
Meta Ads, Google Ads, GSC, Stripe, Claude AI — 24 stories, todas pendientes

### Fase 3 — Funcionalidades Avanzadas
Custom Audiences Meta, Chat Claude AI, Export PDF — 8 stories, todas pendientes

---

## Convenciones

- **Commits en espanol** con prefijos: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- **Ramas:** `main` (produccion), `dev` (desarrollo), `feature/nombre`, `hotfix/nombre`
- **Backend:** JavaScript ES modules, queries SQL directas (NO ORM), validacion con Zod
- **Frontend:** shadcn/ui + Tailwind, React Context (NO Redux), lazy loading por pagina
- **Idioma codigo:** ingles para variables/funciones, espanol para comentarios

> Para la guia completa de desarrollo ver [CLAUDE.md](CLAUDE.md)
