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

## Stack
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS
- **Backend:** Node.js + Express (API REST, puerto 3001)
- **Base de datos:** PostgreSQL
- **Servidor:** VPS Hostinger (Nginx + PM2 + HTTPS)
- **Storage:** Cloudflare R2
- **Email:** Brevo
- **APIs:** Meta Marketing, Google Ads, GSC, Stripe, Claude AI

## Estructura
```
backend/    — API REST Node.js + Express
frontend/   — SPA React + Vite
docs/       — Documentacion tecnica
nginx/      — Configuracion Nginx
scripts/    — Scripts de backup y deploy
```

## Documentacion
Ver carpeta `docs/` para especificaciones completas:
- [Esquema de base de datos](docs/01-esquema-base-datos.md)
- [Estructura de proyecto](docs/02-estructura-proyecto.md)
- [Endpoints API REST](docs/03-api-endpoints.md)
- [Variables de entorno](docs/04-variables-entorno.md)
- [Arquitectura frontend](docs/05-arquitectura-frontend.md)
- [Guia de despliegue](docs/06-despliegue-devops.md)
- [Tareas Jira](docs/07-tareas-jira.md)

## Equipo
- **Manuel Casas** — Propietario
- **Diego** — Desarrollador fullstack
- **Angel** — Desarrollador fullstack
