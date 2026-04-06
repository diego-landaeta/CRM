# Migracion 001 - Schema Inicial

> **Archivo SQL:** `backend/migrations/001_initial_schema.sql`
> **Stories Jira:** CRM-31, CRM-33, CRM-44, CRM-51, CRM-62, CRM-73

---

## Tablas creadas (14)

| # | Tabla | Proposito |
|---|-------|-----------|
| 1 | users | Usuarios del CRM (superadmin, admin, gestor) |
| 2 | projects | Proyectos (Psiko, ISEIH, Fono, IAs) |
| 3 | user_projects | Relacion N:M usuarios-proyectos + orden round-robin |
| 4 | products | Productos/cursos por proyecto |
| 5 | dossiers | PDFs versionados en R2 |
| 6 | leads | Leads con status pipeline |
| 7 | lead_utms | UTMs y canal detectado (1:1 con leads) |
| 8 | lead_status_history | Historial de cambios de status |
| 9 | lead_interactions | Llamadas, emails, whatsapps, notas |
| 10 | lead_reminders | Recordatorios con fecha y completado |
| 11 | conversions | Ventas con importe y metodo pago |
| 12 | conversion_payments | Abonos parciales |
| 13 | project_queue_state | Estado round-robin por proyecto |
| 14 | user_activity_log | Log de actividad (login, logout, cambios) |

## Tipos ENUM creados (7)

- user_role: superadmin, admin, gestor
- project_type: crm, ia
- lead_status: nuevo, por_contactar, contactado, en_seguimiento, convertido, no_interesado
- interaction_type: llamada, email, whatsapp, nota
- payment_method: transferencia, tarjeta, efectivo, fraccionado
- utm_channel: meta_ads, google_ads, tiktok_ads, organico, chatgpt_ia, directo, referido
- api_service: meta, google_ads, gsc, stripe, claude, brevo

## Indices creados (7)

- idx_leads_email (btree)
- idx_leads_project_id
- idx_leads_responsable_status (compuesto)
- idx_leads_project_status (compuesto)
- idx_leads_fecha_solicitud
- idx_lead_status_history_lead_id
- idx_lead_interactions_lead_id
- idx_conversions_project_fecha (compuesto)
- idx_user_activity_log_user_created (compuesto)

---

## Ejecuciones

### crm_test_db (staging)
- **Fecha:** 2026-04-06
- **Resultado:** OK - 14 tablas, 7 enums, 9 indices creados
- **Ejecutado por:** Claude via SSH

### crm_db (produccion)
- **Fecha:** 2026-04-06
- **Resultado:** OK - 14 tablas, 7 enums, 9 indices creados
- **Ejecutado por:** Claude via SSH

---

## Seed: 001_seed_initial.sql

**Archivo:** `backend/seeds/001_seed_initial.sql`

### Datos insertados

| Tabla | Registros | Detalle |
|-------|-----------|---------|
| users | 3 | Manuel (superadmin), Diego (admin), Angel (admin) |
| projects | 6 | Psiko, ISEIH, Fono + 3 IAs |
| products | 12 | 3 Psiko, 2 ISEIH, 3 Fono, 2 Psico IA, 1 Nutri IA, 1 Tarot IA |
| user_projects | 10 | Manuel=todos, Diego=Psiko+ISEIH, Angel=Psiko+Fono |
| project_queue_state | 3 | Round-robin inicializado para los 3 CRM |

### Ejecuciones seed

- **crm_test_db:** 2026-04-06 OK
- **crm_db:** 2026-04-06 OK
- **Password temporal:** CrmTemp2026! (bcrypt cost 12)
