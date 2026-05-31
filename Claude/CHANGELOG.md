# CHANGELOG — CRM hermano

Log cronológico de commits importantes. Para una visión funcional ver [RECENT-WORK-2026-05.md](./RECENT-WORK-2026-05.md).

> Formato: `<hash> <tipo>(scope): mensaje` con notas funcionales si aplica.

---

## 2026-05-28 — Fixes Dayana + Deploy ICTESS

- `1fc3caa feat(scripts):` `import_ictess.mjs` + `fix_ictess.mjs` — importa SOLICITUDES Contactos a ICTESS (project=4) respetando Origen (WhatsApp/Web→whatsapp/organico) y técnicos (Antonio→Tony, Samantha). **154 leads importados.** Después un SQL post-fix cambió Web=organico → directo a pedido del owner.
- `d34aebc fix(layout):` `/prospectos` y `/clientes` funcionan en modo 'Todos los proyectos' — `ALL_PROJECTS_OK` tenía regex `/leads` y `/clients` pero las rutas reales son `/prospectos` y `/clientes` (i18n). **Afecta:** admin/superadmin con varios proyectos asignados ahora ve TODO al estar en ALL mode sin tener que cambiar proyecto.
- `23b20af fix(leads):` recordatorios desde `LeadDrawer` fallaban porque input datetime-local devuelve `YYYY-MM-DDTHH:MM` pero backend valida `YYYY-MM-DD` estricto — separamos fecha (al campo) y hora (a la nota). **Reporte:** Dayana.
- `2bcdcad fix(leads):` 2 bugs reportados por Dayana:
  1. Leads se guardaban SIN programa porque `ProductCombobox` pasa nombre y backend acepta `producto_interes_id` (número). Fix en `LeadFormDialog.handleFormSubmit` que resuelve nombre→ID.
  2. Recordatorios desde `ReminderQuickDialog` enviaban `{fecha: <iso>}` pero backend espera `{fecha_recordatorio: 'YYYY-MM-DD'}`.

## 2026-05-27 — Mensajería + Documentación

- `03a46fe feat(crm):` mensajería interna + sidebar con tabs + auditoría frontend. **Autor:** Manuel/Angel. Agrega módulo `messages`, tabs en sidebar de cada sección, auditoría de acciones FE.
- `77a8619 docs(Claude):` sanitizar credenciales en archivos de memoria (passwords VPS, PAT GitHub) — reemplazadas por `<<placeholders>>`.
- `162b428 docs(Claude):` actualizar memoria + agregar `RECENT-WORK-2026-05` con trabajo reciente.

## 2026-05-26 — Conversiones eliminar con motivo

- `8a71519 feat(conversions):` eliminar compra exige motivo (duplicada/error_carga/anulacion_cliente/otro) y queda en historial.

## 2026-05-25 — Timezone + Cuotas no redondear

- `8342a50 fix(dates):` `formatDate` parsea YYYY-MM-DD como LOCAL (no UTC) en TODO el FE. Reporte: gestoras Venezuela GMT-4 veían -1 día.
- `fbcfa3b fix(cuotas):` no redondear montos, ajustar total a la suma exacta de cuotas. **Bug:** redondeo perdía centavos.
- `fc35674 fix(dates) + feat(cuotas):` CRUD completo de cuotas + bug TZ.
- `b320728 feat(cuotas):` cobrar cuota pide importe + fecha (no asume hoy).

## 2026-05-24 — Branch strategy + Select

- `a2bd13f docs(CLAUDE):` permitir push directo a main para cambios chicos (es el flujo habitual del owner).
- `340cbf7 feat(frontend):` componente `Select<T>` compartido + migración progresiva.

## 2026-05-23 — Edit conversion + Deploy docs

- `839ed59 feat(conversions):` botón Editar para corregir datos cargados (importe, fechas, método).
- `a85f1ab docs:` deploy + estrategia de ramas (`main`=prod, `staging`=QA).

## 2026-05-22 — Permisos gestor

- `d690f4b fix(crm):` gestor puede borrar pagos propios (ownership check via `getPaymentOwnership`) + editor de importe total con descuentos.

## 2026-05-21 — Make webhook + SW killswitch

- `1ffa042 feat(make):` asesora por header `X-Asesora-Email`/`Nombre` + selfDestroying Service Worker. Killswitch SW para limpiar cache después del cambio de dominio.

## 2026-05-20 — Bugs Dayana/Ana A+B+C

- `19cfd3b feat(crm):` bugs A+B+C de Dayana/Ana — duplicados, cuotas, fusión (`mergeLeads`).

## 2026-05-19 — Infra dominio

- `397041d feat(infra):` dominio `360crm.tech` con HTTPS + landing + sitemap + robots.
- `6d6093f feat(make):` botón editable de nombre con lápiz indicador.

## 2026-05-18 — Conector Make + Round-robin fix

- `17c0dc3 feat(make):` conector entrante desde Make.com (webhook + mapeo + test).
- `04107cf fix(leads):` round-robin solo asigna a gestor, no a admin. Query: `AND u.role = 'gestor'`.
- `04e1777 feat(clients):` botón eliminar (soft delete) en listado para superadmin.

## 2026-05 — WooCommerce + Scraper iteraciones

- `3e15b40 feat(scraper):` pares Elementor `heading-title` + auto-cuenta de módulos.
- `5b305b4 fix(woocommerce):` `previewWc` también pasa `cptEndpoints` a `findSeoPage`.
- `ab60774 fix(woocommerce):` auto-sync usa `runFullImport` + `findSeoPage` busca en CPTs.
- `4a0bfc6 feat(woocommerce):` mapping default scraper-based para nuevos proyectos.
- `9a859cb fix(auth):` superadmin/admin ven todos los proyectos en sidebar automáticamente.
- `f8d6053 fix(ui):` buscador de productos normaliza acentos + tokens + mensaje empty state útil.
- `7be6b1b feat(leads):` vincular/cambiar producto desde la ficha + CRM aprende slug→producto.
- `ce25410 feat(webhook):` fallback adicional - resolver producto por slug de landing_url.
- `d176328 feat(scraper):` scraper robusto multi-escenario (retry + fallback duración + keywords expandidos).
- `95edfd0 feat(woocommerce):` auto-detect fallback via `meta_cpt_level` cuando `/types` no expone CPTs.
- `aecb6f3 fix(woocommerce):` auto-detect CPTs envía `project_id` en body + errores tipados.
- `bd9c67a fix(client):` retry automático ante 502/503/504 (deploys con downtime breve).

---

## Tags activos a futuro

- **CRM-119** — Claude Chat (módulo `claude-chat` ya implementado, FE en `ai-chat`)
- **CRM-191** — Branding por proyecto (theme_color en projects → CSS vars)
- **CRM-129..196** — Backlog F4 ver `project_backlog_f4_20260424.md`

---

## Cómo registrar tus cambios

Cuando termines un trabajo, agregá un bloque arriba con:
1. Fecha
2. Lista de commits con mensaje y nota funcional (qué impacto tiene)
3. Si rompió algo o pidió migration → marcarlo

Para mantenerlo limpio: NO incluyas commits de docs/chore menores. Sólo lo que un dev/IA futuro necesita saber para no romper o duplicar trabajo.
