# Índice de migraciones SQL — ISEIH

Fuente de verdad del esquema. Cada archivo en `backend/migrations/` es un SQL ejecutado, en orden. Para el detalle exacto, abrir el .sql. (ISEIE tiene su propia numeración pero el esquema es equivalente por paridad.)

| # | Archivo | Qué hace |
|---|---|---|
| 001 | 001_initial_schema.sql | CRM MultiProyecto — Migracion 001: Schema inicial |
| 002 | 002_products_dossiers.sql | Migración 002: Tablas products y dossiers |
| 003 | 003_refresh_tokens.sql | Migracion 003: Tabla refresh tokens |
| 004 | 004_reincidente.sql | Migracion 004: Campo reincidente en leads |
| 005 | 005_expenses.sql | Migracion 005: Tabla expenses (egresos) |
| 006 | 006_custom_fields.sql | Migracion 006: Campos custom en leads |
| 007 | 007_api_credentials.sql | Migracion 007: Tabla api_credentials |
| 008 | 008_accounts_payable.sql | Migracion 008: Tabla accounts_payable (cuentas por pagar) |
| 009 | 009_product_categories.sql | Migracion 009: Categorias y subcategorias de productos |
| 010 | 010_logos_and_product_pricing.sql | Migracion 010: Logo empresa + campos comerciales de productos |
| 011 | 011_commissions.sql | Migracion 011: Panel de comisiones por gestora (CRM-129) |
| 012 | 012_conversions_product_id.sql | Migracion 012: Vincular conversion a producto (FK) |
| 013 | 013_platform_users.sql | Migracion 013: Usuarios de plataforma (modo IA) |
| 014 | 014_user_avatar.sql | Migracion 014: Avatar de usuario (CRM-186) |
| 015 | 015_project_modules.sql | Migracion 015: Modulos configurables por proyecto (CRM-178) |
| 016 | 016_commissions_rediseno.sql | Migracion 016: Rediseño comisiones (CRM-180) |
| 017 | 017_conversion_installments.sql | Migracion 017: Cuotas en cuentas por cobrar (CRM-183) |
| 018 | 018_lead_form_columns.sql | 018: Configuracion de campos base y columnas del listado de leads |
| 019 | 019_matriculas.sql | 019: Matriculas (post-conversion) |
| 020 | 020_email_sequences.sql | 020: Secuencias de email seguimiento (CRM-185) |
| 021 | 021_forms.sql | 021: Editor de forms (CRM-175) |
| 022 | 022_payroll.sql | 022: Nominas (CRM-171, CRM-173) |
| 023 | 023_woocommerce.sql | 023: WooCommerce import + mapeo (CRM-177) |
| 024 | 024_forms_webhook_matriculas_admision_wc_autosync.sql | 024: 3 mejoras |
| 025 | 025_webhook_listen_mode.sql | 025: Modo escucha tipo Make/Zapier para webhook tokens |
| 026 | 026_role_soporte.sql | 026: Rol "Desarrollador - Soporte" (rol generico que ve todos los proyectos) |
| 027 | 027_form_destination.sql | 027: Webhook destination + listen mode default |
| 028 | 028_audiences_ia_reports_chat.sql | 028: Tablas para audiences, ia metrics, reports, chat IA |
| 029 | 029_documents.sql | 029: Módulo de documentos — facturas y certificados |
| 029 | 029_user_views.sql | 029: Vistas personalizadas por usuario (CRM-301) |
| 030 | 030_field_definitions_multi_entity.sql | Migracion 030: Campos custom multi-entidad (lead, client, product) |
| 030 | 030_installation_bundles.sql | 030: Bundles de instalacion (CRM-302) |
| 031 | 031_performance_indexes.sql | Migración 031: índices FK faltantes + columna notificado_at en lead_reminders |
| 032 | 032_project_channels.sql | Migración 032: canales embebidos por proyecto (CRM-208 / CRM-211) |
| 033 | 033_roles_permissions.sql | Migración 033: Custom roles + overrides de permisos por usuario |
| 037 | 037_status.sql | Migración 037: Página de status del sistema |
| 038 | 038_lead_emails_and_shortcuts.sql | Migración 038: lead_emails (CRM-231) + projects.shortcuts (CRM-235) |
| 039 | 039_categories_tree.sql | Migración 039: árbol N niveles para product_categories |
| 039 | 039_document_audit_log.sql | 038: Audit log de documentos (factura/certificado) |
| 040 | 040_documents_r2_and_email.sql | 039: Documents — almacenamiento en R2 + auto-email |
| 040 | 040_role_views.sql | Migración 040: vista por defecto de roles custom |
| 041 | 041_product_image.sql | 041_product_image.sql |
| 042 | 042_email_templates.sql | 042_email_templates.sql |
| 043 | 043_external_panels.sql | Migración 043: paneles externos por proyecto (CRM-155) |
| 044 | 044_sidebar_labels.sql | Migración 044: etiquetas custom del sidebar por proyecto (CRM-217) |
| 045 | 045_product_modules.sql | Migración 045: módulos/temario de productos |
| 045 | 045_theme_color.sql | Migración 045: color primario por proyecto (CRM-191) |
| 046 | 046_project_connectors.sql | Migración 046: Conectores configurables por proyecto |
| 047 | 047_webhook_subtype.sql | Migración 047: distinguir webhook JSON vs mailhook (email entrante) |
| 048 | 048_wc_field_mapping.sql | Migración 048: mapping configurable para WC import |
| 049 | 049_webhook_default_product.sql | Migración 049: producto por defecto + matching por URL en webhooks |
| 050 | 050_form_template_events.sql | Migración 050: historial de eventos recibidos por webhook/mailhook/form |
| 051 | 051_wc_default_currency.sql | Migración 051: divisa por defecto del WC import (no por producto) |
| 052 | 052_wp_acf_importer.sql | Migración 052: importer multi-fuente WP REST + ACF |
| 053 | 053_unify_sections_as_text.sql | Migración 053: simplificar — secciones como TEXT unificado |
| 054 | 054_products_modalidad.sql | Añadir columna modalidad que el scraper rellena ("Online", "Presencial", etc.) |
| 055 | 055_leads_email_nullable.sql | Migración 055: email del lead pasa a ser NULLABLE |
| 056 | 056_add_whatsapp_canal.sql | Migración 056: añadir 'whatsapp' al enum utm_channel |
| 057 | 057_user_availability.sql | Migración 057: disponibilidad de gestores |
| 058 | 058_leads_soft_delete.sql | Migración 058: soft delete de leads + auditoría |
| 059 | 059_leads_propuesto.sql | Migración 059: flag "propuesto" |
| 060 | 060_conversion_refunds.sql | Migración 060: devoluciones (refunds) por conversión |
| 061 | 061_lead_spam_reports.sql | Migración 061: reportes de spam |
| 062 | 062_product_url_aliases.sql | Migración 062: alias de URLs por producto |
| 063 | 063_make_webhooks.sql | Make.com webhooks: cada proyecto puede tener N "conectores" hacia Make. |
| 064 | 064_messaging.sql | 064_messaging.sql — Sistema de mensajeria interna |
| 065 | 065_normalize_phones.sql | Normaliza todos los teléfonos al formato E.164 con +. |
| 066 | 066_products_list_index.sql | products_list_index |
| 066 | 066_sales_goals.sql | Metas de venta por gestor + periodo (mensual). |
| 067 | 067_admin_notifications.sql | Notificaciones para admin/superadmin (eventos que necesitan visibilidad operativa). |
| 068 | 068_sales_goal_history.sql | Historial de cambios en metas de venta. Snapshot del estado anterior cada |
| 069 | 069_meta_ads.sql | Integración Meta Marketing API (extracción de métricas, solo lectura). |
| 070 | 070_lead_audit_log.sql | Audit log de cambios en la ficha de un lead. |
| 071 | 071_dup_review_queue.sql | Cola de revisión de duplicados. |
| 072 | 072_lead_products.sql | Multi-cursos por lead (#18). |
| 073 | 073_meta_adsets_ads.sql | Etapa 3: AdSets y Ads. Misma forma que campaigns (snapshot + daily). |
| 074 | 074_meta_multi_account.sql | Multi-cuenta: un proyecto puede tener N cuentas publicitarias Meta. |
| 075 | 075_meta_adset_products.sql | Asociar productos a AdSets (no solo a campañas). Cada adset suele corresponder |
| 076 | 076_default_por_contactar.sql | Default del estado de un lead nuevo cambia de 'nuevo' → 'por_contactar'. |
| 077 | 077_change_requests.sql | Módulo RFC (Request For Change): solicitud de cambio + aprobaciones CCB + adjuntos. |
| 078 | 078_rfc_project_optional.sql | RFC sin proyecto = "General" (cambios cross-proyecto o de plataforma). |
| 079 | 079_user_projects_recibe_leads.sql | Opt-in per-project para que admins reciban leads del round-robin. |
| 080 | 080_admin_notifs_target_users.sql | Notificaciones dirigidas a usuarios concretos (no solo broadcast a admins). |
| 081 | 081_backfill_conversion_producto_id.sql | Backfill: rellenar conversions.producto_contratado_id matching por nombre. |
| 082 | 082_epic_b_expenses_extensions.sql | EPIC B — Egresos / Gastos |
| 083 | 083_leads_identificacion_fiscal.sql | 083 — Campo opcional de identificación fiscal en leads (para facturas). |
| 084 | 084_leads_direccion_fiscal.sql | 084 — Campo opcional de dirección fiscal en leads (para facturas). |
| 085 | 085_cpt_only_strategy.sql | 085 — Modo importer "cpt_only": sitios WP con CPTs custom pero SIN WooCommerce. |
| 086 | 086_project_integrations.sql | 086 — project_integrations: credenciales por proyecto para Stripe / Brevo / etc. |
| 087 | 087_lead_status_proxima_convocatoria.sql | 087 — Añade el valor 'proxima_convocatoria' al enum lead_status. |
| 088 | 088_stripe_payments.sql | Migracion 088: stripe_payments |
| 089 | 089_stripe_disputes_extra.sql | Campos extra para gestion de disputas: |
| 090 | 090_invoices.sql | Migracion 090: Facturacion (modelo aprobado 2026-06-17) |
| 091 | 091_invoices_extras.sql | Migracion 091: metodo_pago, pie_pago, y reset de secuencia por admin |
| 092 | 092_conversion_items_iva.sql | Migracion 092: multi-item en conversiones + IVA configurable |
| 093 | 093_whatsapp_widget.sql | Migracion 093: Widget WhatsApp rotativo por proyecto |
| 094 | 094_invoices_rectificativa.sql | Migracion 094: Facturas rectificativas (de abono) |
| 095 | 095_descuentos.sql | Migracion 095: Descuentos por cuadros en conversiones y facturas |
| 096 | 096_invoice_issuers.sql | Migracion 096: Multi-emisor de facturas |
| 097 | 097_issuer_logo_key.sql | issuer_logo_key |
| 098 | 098_invoice_templates.sql | Plantillas visuales de factura (editor tipo Canva). Cada plantilla guarda un |
| 099 | 099_issuer_serie.sql | issuer_serie |
| 100 | 100_template_condicion.sql | template_condicion |
