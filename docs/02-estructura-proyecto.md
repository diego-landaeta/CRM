# 02 - Estructura del Proyecto

> **Ultima actualizacion:** 2026-04-02
> **Stack:** React 18 + Vite 6 + Node.js + Express + PostgreSQL 16
> **Estado frontend Fase 1:** 100% (20/20 tickets Jira Done)
> **Estado backend Fase 1:** 19% (schemas + products/dossiers)

---

## 1. Estructura de carpetas

Arquitectura modular: cada dominio contiene todo su codigo. Compartido en `shared/`.

```
crm/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/index.js              # Placeholder — pendiente Diego
│   │   │   ├── users/index.js             # Placeholder — pendiente Diego
│   │   │   ├── leads/index.js             # Placeholder — pendiente Diego
│   │   │   ├── products/                  # ✅ CRUD completo (Angel)
│   │   │   │   ├── index.js, product.routes.js, product.controller.js
│   │   │   │   ├── product.service.js, product.model.js, product.validation.js
│   │   │   └── dossiers/                  # ✅ Upload R2 + versiones (Angel)
│   │   │       ├── index.js, dossier.routes.js, dossier.controller.js
│   │   │       ├── dossier.service.js, dossier.model.js, dossier.validation.js
│   │   ├── shared/
│   │   │   ├── config/db.js, r2.js
│   │   │   ├── middleware/auth.js, projectAccess.js, errorHandler.js, upload.js
│   │   │   ├── services/r2.service.js
│   │   │   └── utils/AppError.js, logger.js, presignedUrl.js
│   │   └── app.js
│   ├── migrations/001_initial_schema.sql, 002_products_dossiers.sql
│   ├── seeds/001_seed_initial.sql
│   ├── ecosystem.config.js, package.json, .env.example
│
├── frontend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── leads/
│   │   │   │   ├── components/LeadFormDialog.jsx, ConversionDialog.jsx
│   │   │   │   ├── hooks/useLeads.js
│   │   │   │   ├── pages/LeadsPage, LeadsPipelinePage, LeadDetailPage, AudienceExportPage
│   │   │   │   └── validation/lead.schema.js
│   │   │   ├── products/
│   │   │   │   ├── api/products.api.js, dossiers.api.js
│   │   │   │   ├── components/DossierPanel.jsx, ProductFormDialog.jsx
│   │   │   │   ├── hooks/useProducts.js, useDossiers.js
│   │   │   │   ├── pages/ProductsPage.jsx, ProductDetailPage.jsx
│   │   │   │   └── validation/product.schema.js
│   │   │   ├── campaigns/pages/CampaignsPage.jsx
│   │   │   ├── revenue/pages/RevenuePage.jsx
│   │   │   ├── reports/pages/ReportsPage.jsx
│   │   │   └── settings/pages/SettingsPage.jsx
│   │   ├── shared/
│   │   │   ├── api/client.js                    # fetch nativo (0 deps, 0 vulns)
│   │   │   ├── components/
│   │   │   │   ├── layout/AppLayout, Sidebar, ProtectedRoute, Toaster, CommandPalette
│   │   │   │   └── ui/accordion, badge, button, portal, progress
│   │   │   ├── data/mock.js                     # Mock data centralizado por proyecto
│   │   │   ├── hooks/useDashboard.js, useProject.js, useToast.js
│   │   │   ├── lib/utils.js
│   │   │   └── pages/DashboardPage, LoginPage, SetPasswordPage, ProfilePage
│   │   ├── contexts/AuthContext, ProjectContext, ThemeContext
│   │   ├── App.jsx, main.jsx, index.css
│   ├── public/favicon.svg
│   ├── tailwind.config.js, vite.config.js, package.json
│
├── docs/                                         # 7 docs MD + 3 PDFs
├── scripts/                                      # generate_status_report.py, md_to_pdf.py
├── .gitignore, CLAUDE.md
```

---

## 2. Rutas frontend

| Ruta | Pagina | Auth | Layout |
|---|---|---|---|
| `/login` | LoginPage | No | Sin sidebar |
| `/set-password` | SetPasswordPage | No | Sin sidebar |
| `/` | DashboardPage | Si | AppLayout |
| `/leads` | LeadsPage | Si | AppLayout |
| `/leads/pipeline` | LeadsPipelinePage | Si | AppLayout |
| `/leads/audiences` | AudienceExportPage | Si | AppLayout |
| `/leads/:id` | LeadDetailPage | Si | AppLayout |
| `/products` | ProductsPage | Si | AppLayout |
| `/products/:id` | ProductDetailPage | Si | AppLayout |
| `/campaigns` | CampaignsPage | Si | AppLayout |
| `/revenue` | RevenuePage | Si | AppLayout |
| `/reports` | ReportsPage | Si | AppLayout |
| `/settings` | SettingsPage | Si | AppLayout |
| `/profile` | ProfilePage | Si | AppLayout |

---

## 3. Roles (5)

| Rol | Acceso | Gestiona usuarios |
|---|---|---|
| superadmin | Total | Si |
| admin | Operativo completo | No |
| gestor | Solo proyectos asignados | No |
| direccion | Solo lectura (reportes, dashboard, IA) | No |
| operativo | Tareas internas, sin datos comerciales | No |

---

## 4. Pipeline de leads (6 estados)

```
Nuevo → Por contactar → Contactado → En seguimiento → Convertido → No interesado
```

- **"No interesado"** → motivo perdida obligatorio (loss_reason enum)
- **"Convertido"** → abre ConversionDialog (producto, importe, metodo pago)

---

## 5. Base de datos

**26 tablas, 10 ENUMs.** Ver `docs/01-esquema-base-datos.md`.

Fase 1 (14): users, projects, user_projects, products, dossiers, leads, lead_utms, lead_status_history, lead_interactions, lead_reminders, conversions, conversion_payments, project_queue_state, user_activity_log

Fase 2 (12): api_credentials, meta/google_campaign_metrics, gsc_metrics, ia_monthly_metrics, ai_reports, expenses, team_activities, team_tasks, team_task_comments, ad_conversions_sent, gdpr_requests

---

## 6. Features implementadas (frontend Fase 1 — 100%)

- Login + auth mock + proteccion rutas + redirect
- Set password con validacion tiempo real
- Dashboard: 4 KPIs + bar chart + donut + leads recientes + filtro fecha
- Leads: tabla + filtros + stats 7 columnas + paginacion + busqueda
- Pipeline: Kanban 6 columnas drag & drop
- Ficha lead: info completa + interacciones + recordatorios + dossier enviado + alerta duplicado + alerta dias sin actualizar
- Conversion: dialog con importe total/pagado/pendiente + metodo pago + validacion zod
- Productos: cards grid + CRUD + formulario zod + confirm desactivar
- Dossiers: drag&drop upload + versiones accordion + presigned URLs
- Campanas: tabs Meta/Google + cards metricas CPL
- Ingresos: KPIs + area chart 6 meses + tabla conversiones
- Reportes: metricas + lista reportes PDF + boton generar IA
- Settings: 5 tabs (usuarios CRUD, proyectos, APIs, email Brevo, seguridad)
- Perfil: editar nombre/email + cambiar password + toggle tema
- Audiencias: 4 presets + filtros + preview + export CSV SHA256
- Dark mode + Command palette Cmd+K + Toast system + Responsive mobile

---

## 7. Features pendientes

### Fase 2 — Requiere backend

| Feature | Tipo |
|---|---|
| Asignacion por carga/especialidad/disponibilidad | Backend |
| Dashboard financiero (ingresos vs gastos, beneficio neto) | Full |
| Vista actividad equipo (frontend "Mi dia", direccion real-time) | Full |
| Meta Ads API + Google Ads API + GSC + Stripe | Backend |
| Conversions API Meta/Google | Backend |
| Ranking campanas por eficacia real (matriculas, no leads) | Frontend |
| Mapa leads por pais | Frontend |
| Informe semanal email auto | Backend |

### Fase 3 — IA + Automatizaciones

| Feature | Tipo |
|---|---|
| Score IA prediccion cierre (0-100) | Backend + Claude |
| Leads calientes (priorizacion auto) | Backend |
| Deteccion anomalias | Backend + Claude |
| Proyeccion ingresos trimestral | Backend + Claude |
| Chat con datos (SSE streaming) | Full |
| Lead Ads webhook directo | Backend |
| Export PDF reportes | Backend |

---

## 8. Exclusiones confirmadas

| Feature | Motivo |
|---|---|
| WhatsApp Business API | No va en este proyecto |
| Bot cualificacion WhatsApp | No va en este proyecto |
| Modulo gestion alumnos (post-venta) | Especifico ISEIE, no aplica |

---

## 9. Dependencias frontend

| Paquete | Uso |
|---|---|
| react ^18.3 + react-dom | Framework |
| react-router-dom ^6.28 | Routing |
| @phosphor-icons/react ^2.1 | Iconos |
| recharts ^2.14 | Graficas |
| react-hook-form ^7.54 + @hookform/resolvers ^3.9 | Forms |
| zod ^3.23 | Validacion |
| react-dropzone ^14.3 | Upload drag&drop |
| @radix-ui/react-accordion ^1.2 + react-slot ^1.1 | Primitivas UI |
| class-variance-authority ^0.7, clsx ^2.1, tailwind-merge ^2.6 | Estilos |
| tailwindcss-animate ^1.0 | Animaciones |

**Eliminado:** axios (vulns), lucide-react (migrado a Phosphor), 10 Radix primitivas no usadas, @types/react

---

## 10. Convenciones

- **Backend:** JS ES modules, kebab-case, async/await, SQL directo (NO ORM), Zod, AppError
- **Frontend:** PascalCase componentes, Tailwind (no CSS modules), Context (no Redux), fetch nativo, Phosphor icons, react-hook-form + zod, Portal para dialogs
- **Commits:** espanol, prefijos feat:/fix:/refactor:/docs:/chore:/test:
- **0 vulnerabilidades npm**
