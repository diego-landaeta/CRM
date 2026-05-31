# CURRENT-STATE — CRM hermano (snapshot 2026-05-29)

Snapshot operativo. Para cifras live correr los queries al final.

---

## Despliegue

| | Producción | Staging |
|---|---|---|
| URL | `https://360crm.tech/crm/` | `https://360crm.tech/testeo/` |
| Backend API | `:3001` (PM2 `crm-api-production`) | `:3002` (PM2 `crm-api-staging`) |
| DB | `crm_prod_db` | `crm_test_db` |
| Frontend | `/var/www/crm/production/frontend/` | `/var/www/crm/staging/frontend/` |
| Backend code | `/opt/crm/production/` (NO git) | `/opt/crm/staging/` |
| Bundle FE actual | `index-D6hX6GuZ.js` (deploy 28-may) | — |
| Último commit en `main` | `1fc3caa` (28-may) | — |

---

## Proyectos activos

| ID | Slug | Nombre | Tipo |
|---|---|---|---|
| 1 | psiko-aprende | Psiko Aprende | educativo |
| 2 | iseih | ISEIH | educativo |
| 3 | fono-aprende | Fono Aprende | educativo |
| 4 | ictess | ICTESS | educativo |
| 5 | psicologo-ia | Psicólogo IA | plataforma IA |
| 6 | nutricionista-ia | Nutricionista IA | plataforma IA |
| 7 | tarot-ia | Tarot IA | plataforma IA |

(Run `SELECT id, slug, nombre FROM projects ORDER BY id;` para el listado live)

---

## Users del CRM (rol gestor/admin/superadmin)

Datos a 2026-05-28:
| id | nombre | email | rol |
|---|---|---|---|
| 1 | Admin Principal | admin@iseih.com | superadmin |
| 2 | Manuel Casas | manualcasasprofesional@gmail.com | superadmin |
| 3 | Diego | diego.landaeta.seo@gmail.com | soporte |
| 4 | Diego 2 | diego.a.programmer@gmail.com | gestor |
| 5 | Diego 2 | diego.a.landaeta@gmail.com | gestor |
| 6 | Ana Comercial | anamarcela04@gmail.com | gestor |
| 7 | Dayana Comercial | dayanapsikoaprende@gmail.com | gestor |
| 8 | Samantha Ictess | admisiones@ictess.com | gestor |
| 9 | Tony (Antonio) | antonio_uclesc@hotmail.com | admin |

---

## Migraciones aplicadas

Última: `064_messaging.sql`. Total migrations en `backend/migrations/`:

| # | Tema clave |
|---|---|
| 001 | initial schema (projects, users, leads) |
| 002 | products + conversions |
| 010 | logo_url + precio/moneda |
| 055 | leads_email_nullable |
| 056 | add_whatsapp_canal (enum utm_channel) |
| 057 | user_availability |
| 058 | leads_soft_delete |
| 059 | leads_propuesto |
| 060 | conversion_refunds |
| 061 | lead_spam_reports |
| 062 | product_url_aliases |
| 063 | make_webhooks |
| 064 | messaging (interna) |

(Ver `backend/migrations/` para todas)

---

## Integraciones activas

### Make.com webhooks entrantes
- Tabla `make_webhooks` + `make_webhook_deliveries`
- Headers de override: `X-Asesora-Email`, `X-Asesora-Nombre`, `X-Canal`, `X-Make-Secret`
- Modo TEST (solo guarda) / ACTIVE (crea lead)
- URL endpoint: `POST /api/webhooks/make/:slug`

### WooCommerce / WordPress importer
- 3 estrategias: `wc_only` (productos WC), `wc_plus_cpt` (WC + custom post types con ACF), `wp_pages` (páginas WP directas)
- Scraper HTML extrae: secciones (Plan de Estudios/Objetivos/Beneficios/etc.), meta_box (precio/horas/duración/modalidad), stripe_link, brochure PDF, OG image
- Sync programable cada N minutos

### Service Worker PWA
- `selfDestroying: true` en vite config — después del cambio de dominio se ejecuta killswitch para limpiar cache vieja

### Email Brevo
- Templates configurables por proyecto
- Sequences/drip campaigns con triggers (lead_created, status_changed, etc.)

### R2 (Cloudflare)
- Storage S3-compatible para dossiers PDF
- Pre-signed URLs 15min para descarga autenticada

### Claude AI (módulo `claude-chat`)
- SSE streaming endpoint `POST /api/claude/chat`
- Requiere `ANTHROPIC_API_KEY` en `.env`
- Frontend en `frontend/src/modules/ai-chat/` con flag `USE_MOCKS` para fallback demo

---

## Status de los 2 reportes recientes de Dayana

| Bug | Commit fix | Deploy | Estado |
|---|---|---|---|
| Leads se guardan sin programa | `2bcdcad` | 28-may | ✅ live |
| Recordatorios no se guardan (ReminderQuickDialog) | `2bcdcad` | 28-may | ✅ live |
| Recordatorios no se guardan (LeadDrawer datetime-local) | `23b20af` | 28-may | ✅ live |

---

## Para sacar cifras live actualizadas

```bash
ssh claude@187.124.128.126 "PGPASSWORD=<<PG_PASS>> psql -h localhost -U crm_user -d crm_prod_db -c \"
SELECT
  p.id, p.nombre,
  (SELECT COUNT(*) FROM leads l WHERE l.project_id=p.id AND l.deleted_at IS NULL) AS leads_activos,
  (SELECT COUNT(*) FROM leads l WHERE l.project_id=p.id AND l.deleted_at IS NULL AND l.status='convertido') AS convertidos,
  (SELECT COUNT(*) FROM products WHERE project_id=p.id AND active) AS productos_activos,
  (SELECT COUNT(*) FROM conversions WHERE project_id=p.id) AS conversiones,
  (SELECT COALESCE(SUM(importe_total),0) FROM conversions WHERE project_id=p.id) AS ventas_total
FROM projects p ORDER BY p.id;
\""
```

---

## Pendientes conocidos

Ver:
- [project_pendientes_post_beta.md](./project_pendientes_post_beta.md) — gaps no bloqueantes
- [project_backlog_f4_20260424.md](./project_backlog_f4_20260424.md) — backlog Jira F4 (CRM-129..196)
- [project_pending_diplomados_recibos.md](./project_pending_diplomados_recibos.md) — certificados PDF con `_texto` fields
- [BACKEND-PENDIENTE.md](./BACKEND-PENDIENTE.md) — pendientes técnicos (puede estar desactualizado)

### Resumen pendientes activos

- Firma canvas en matrículas
- Triggers email automáticos al cambiar lead state (parcial — el módulo existe pero falta wiring final)
- UI mapeo WC más amigable
- Certificados PDF usando `_texto` de products
- Revisar 17 leads sin `lead_utms` (de imports antiguos)
