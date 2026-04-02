# PROMPT PARA CREAR PROYECTO JIRA — CRM MultiProyecto

Copia y pega todo este bloque en tu sesion de Claude con Atlassian/Jira conectado:

---

Necesito que crees un proyecto completo en Jira para el CRM MultiProyecto con la siguiente estructura. Primero crea el proyecto, luego los epics, y finalmente las stories dentro de cada epic.

## PROYECTO
- **Nombre:** CRM MultiProyecto
- **Clave:** CRM
- **Tipo:** Scrum
- **Descripcion:** Sistema interno de gestion de leads, conversiones, campanas publicitarias y monitorizacion de ingresos. Stack: React + Node.js + PostgreSQL. Proyectos: Psiko Aprende, ISEIH, Fono Aprende (CRM) + Psicologo IA, Nutricionista IA, Tarot IA (monitorizacion).

## MIEMBROS DEL EQUIPO
Agrega a estos dos usuarios como miembros del proyecto:
- **Diego** — Desarrollador fullstack
- **Angel** — Desarrollador fullstack

## EPICS (crear los 15 en orden)

1. **[F1] Setup Infraestructura** — Subfase 1.1 — Semana 1
2. **[F1] Auth + Roles + Panel Usuarios** — Subfase 1.2 — Semana 1
3. **[F1] Productos + Dossiers PDF** — Subfase 1.3 — Semana 1
4. **[F1] Webhook + UTMs + Round-robin** — Subfase 1.4 — Semana 2
5. **[F1] Ficha Lead + Historial + Seguimiento** — Subfase 1.5 — Semana 2
6. **[F1] Conversiones y Pagos** — Subfase 1.6 — Semana 2-3
7. **[F1] Dashboard + QA Integral** — Subfase 1.7 — Semana 3
8. **[F2] Setup Credenciales API** — Subfase 2.1 — Semana 4
9. **[F2] Meta Ads API** — Subfase 2.2 — Semana 4-5
10. **[F2] Google Ads API** — Subfase 2.3 — Semana 5
11. **[F2] Google Search Console** — Subfase 2.4 — Semana 5-6
12. **[F2] Stripe Monitor IA** — Subfase 2.5 — Semana 6
13. **[F2] Audiencias CSV + Reportes Claude** — Subfase 2.6 — Semana 6-7
14. **[F3] Custom Audiences Meta + Lead Ads Webhook** — Subfases 3.1 y 3.2 — Semana 8-9
15. **[F3] Chat Claude AI + Export PDF** — Subfases 3.3 y 3.4 — Semana 9-9.5

## STORIES (crear dentro de cada epic)

### EPIC 1: [F1] Setup Infraestructura

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-001 | Instalar Node.js LTS, PostgreSQL 16 y PM2 en VPS | Diego | 3 | Node v20+ instalado; PostgreSQL 16 corriendo en :5432; PM2 global instalado |
| F1-002 | Configurar Nginx: /crm + /crm/api + HTTPS | Diego | 5 | GET /crm carga React; GET /crm/api/health retorna 200; HTTPS con Certbot; try_files SPA no da 404 |
| F1-003 | PM2 ecosystem.config.js + arranque automatico | Diego | 2 | pm2 start levanta crm-api; reiniciar VPS arranca solo; logs en /var/log/pm2/ |
| F1-004 | Configurar Cloudflare R2: bucket privado + SDK | Angel | 2 | Bucket creado; upload de prueba funciona; pre-signed URL permite descarga |
| F1-005 | Configurar Brevo: dominio + 4 templates email | Diego | 3 | Dominio verificado DKIM+SPF; 4 templates creados; email prueba llega correctamente |
| F1-006 | Inicializar repo Git + estructura carpetas + .gitignore | Angel | 2 | Repo GitHub con main+dev; estructura carpetas creada; .gitignore correcto; package.json en backend y frontend |
| F1-007 | Ejecutar migracion SQL inicial + seed data | Ambos | 3 | Todas tablas Fase 1 creadas; seed data insertada (superadmin + 6 proyectos); conexion Node funciona |
| F1-008 | Script backup pg_dump diario a R2 + cron | Diego | 3 | Script genera dump+gzip; sube a R2 con fecha; cron 3AM diario; backup verificado restaurable |

### EPIC 2: [F1] Auth + Roles + Panel Usuarios

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-009 | Schema DB: users, projects, user_projects | Diego | 2 | Tablas creadas con todos campos; FKs funcionan; UNIQUE en email |
| F1-010 | Endpoints auth: login, logout, refresh | Diego | 5 | Login devuelve accessToken + cookie httpOnly; logout limpia cookie; refresh genera nuevo token; expirado retorna 401 |
| F1-011 | JWT access 15min + refresh 30d httpOnly cookie | Diego | 3 | Access expira 15min; refresh en httpOnly/Secure/SameSite; logout invalida refresh en DB |
| F1-012 | Middleware roleGuard + projectAccess | Diego | 5 | Gestor no accede rutas Admin (403); Gestor no ve leads proyecto no asignado (403); SA accede a todo |
| F1-013 | CRUD usuarios + email bienvenida Brevo | Diego | 5 | POST crea usuario + email bienvenida; link set-password expira 24h; GET lista con filtros; PATCH edita; soft delete |
| F1-014 | Endpoint set-password con token unico | Diego | 2 | Token valido setea password; expirado retorna 400; usado retorna 400; bcrypt cost 12 |
| F1-015 | Tabla user_activity_log + registro automatico | Diego | 2 | Login/logout/cambios rol se registran; incluye user_id, accion, IP, timestamp |
| F1-016 | Frontend: pantalla login | Diego | 3 | Formulario email+password; error visible si incorrecto; redirect a dashboard; responsive |
| F1-017 | Frontend: AuthContext + ProjectSelector navbar | Diego | 5 | AuthContext provee user/role; ProjectSelector muestra proyectos asignados; persiste en localStorage |
| F1-018 | Frontend: panel admin usuarios (tabla + CRUD) | Diego | 5 | Tabla con nombre/email/rol/proyectos/estado; crear con checkboxes proyectos; editar rol; desactivar con confirmacion |
| F1-019 | Frontend: pantalla set-password | Diego | 2 | Campos password + confirmacion; validacion fuerza minima; mensaje exito + redirect login |

### EPIC 3: [F1] Productos + Dossiers PDF

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-020 | Schema DB: products, dossiers | Angel | 1 | Tablas creadas; FKs a projects y users funcionan |
| F1-021 | CRUD productos por proyecto | Angel | 3 | Crear/listar/editar/desactivar; filtro por projectId; solo productos de proyectos asignados |
| F1-022 | Upload PDF a R2 con uuid+timestamp | Angel | 5 | PDF sube correctamente; >5MB funciona; solo PDF (400 si otro MIME); registro en dossiers |
| F1-023 | Endpoint pre-signed URL (15min, autenticados) | Angel | 3 | URL valida 15min; expirada da acceso denegado; no autenticado 401 |
| F1-024 | Historial versiones dossier | Angel | 2 | Nueva version marca anterior inactive; historial muestra todas versiones; activa = mas reciente |
| F1-025 | Frontend: panel gestion productos | Angel | 3 | Lista productos; crear/editar via dialog; desactivar con confirmacion; indicador dossier |
| F1-026 | Frontend: upload dossier drag&drop + versiones | Angel | 5 | Drag&drop funcional; barra progreso; version actual visible; historial en acordeon |

### EPIC 4: [F1] Webhook + UTMs + Round-robin

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-027 | Schema DB: leads, lead_utms, project_queue_state | Diego | 2 | Tablas creadas; indices en email, project_id, (responsable_id, status) |
| F1-028 | Endpoint POST /webhooks/leads/:slug + API key | Diego | 5 | API key invalida 401; payload valido crea lead 201; respuesta <500ms; invalido 400 |
| F1-029 | Parseo UTMs + deteccion canal automatica | Diego | 3 | UTMs extraidos de URL; canal detectado (meta/google/organico/directo/chatgpt) |
| F1-030 | Deteccion duplicados por email + vinculacion | Diego | 3 | Mismo email crea nuevo con lead_duplicado_de; mismo proyecto+producto marca reincidente |
| F1-031 | Round-robin transaccional PostgreSQL | Diego | 8 | 2 gestores + 3 leads = A,B,A; inactivo se salta; BEGIN/COMMIT; 50 simultaneos 0 errores |
| F1-032 | Notificacion Brevo asincrona al gestor | Diego | 3 | Email <10seg; datos lead + enlace ficha; webhook responde ANTES de enviar email |
| F1-033 | CORS por dominio de proyecto (no wildcard) | Diego | 1 | Dominio autorizado funciona; no autorizado rechazado |
| F1-034 | Indices PostgreSQL optimizados para leads | Diego | 1 | Indices en email, (project_id,status), (responsable_id,status), fecha_solicitud |
| F1-035 | Frontend: lista leads con filtros | Diego | 5 | Filtros combinados; paginacion server-side; Gestor solo sus proyectos; busqueda nombre/email |
| F1-036 | Frontend: vista pipeline por status | Diego | 5 | 6 columnas por status; cards con datos; toggle lista/pipeline; contadores |
| F1-037 | Frontend: badge duplicados + alerta inactividad | Diego | 2 | Badge "Duplicado" con link original; alerta amarilla >N dias sin actividad |

### EPIC 5: [F1] Ficha Lead + Historial + Seguimiento

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-038 | Schema DB: lead_status_history, lead_interactions, lead_reminders | Angel | 1 | Tablas creadas; FKs funcionan; indices en lead_id |
| F1-039 | PATCH /leads/:id/status con registro historial | Angel | 3 | Cambio crea registro history con usuario/timestamp; solo gestores asignados o Admin/SA |
| F1-040 | POST /leads/:id/interactions | Angel | 2 | Crear interaccion (llamada/email/whatsapp/nota); listar por lead_id ordenadas fecha DESC |
| F1-041 | POST /leads/:id/reminders + cron diario | Angel | 5 | Crear recordatorio; cron 8AM detecta hoy y envia email; marcar completado |
| F1-042 | Reasignacion manual lead (solo Admin/SA) | Angel | 2 | Gestor no puede (403); Admin/SA reasigna a gestor del proyecto; registra en history |
| F1-043 | Frontend: ficha lead completa | Angel | 5 | Datos + UTMs + canal + badge duplicado + link original |
| F1-044 | Frontend: selector status con confirmacion | Angel | 3 | Dialog confirmacion; si Convertido redirige a formulario conversion |
| F1-045 | Frontend: timeline interacciones | Angel | 5 | Iconos por tipo; fecha/hora/usuario/nota; orden cronologico; boton agregar |
| F1-046 | Frontend: boton dossier + checkbox enviado | Angel | 3 | Boton visible si producto tiene dossier; copiar enlace; marcar enviado registra fecha |
| F1-047 | Frontend: formulario recordatorio | Angel | 2 | DatePicker sin fechas pasadas; nota opcional; aparece en lista inmediatamente |
| F1-048 | Frontend: historial duplicado | Angel | 2 | Si duplicado, muestra interacciones original; link al lead original |

### EPIC 6: [F1] Conversiones y Pagos

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-049 | Schema DB: conversions, conversion_payments | Angel | 1 | Tablas creadas; FKs funcionan; importe_pendiente calculado app-level |
| F1-050 | Registrar conversion (auto cambia status) | Angel | 3 | POST crea conversion; status cambia a convertido; historial registrado |
| F1-051 | Agregar abono parcial + recalculo pendiente | Angel | 3 | POST payment; importe_pagado actualizado; pendiente = total - pagado; no exceder pendiente |
| F1-052 | Cron pagos vencidos + notificacion email | Angel | 3 | Cron 9AM detecta vencidos; email al responsable; no duplica notificacion |
| F1-053 | Frontend: formulario conversion | Angel | 5 | Campos completos; validacion; se despliega al marcar Convertido |
| F1-054 | Frontend: dashboard pagos pendientes | Angel | 3 | Lista con alertas; rojo vencido; amarillo <3 dias; filtrable |
| F1-055 | Frontend: vista ingresos por proyecto | Angel | 3 | Facturado/cobrado/pendiente; filtrable por mes; desglose individual |

### EPIC 7: [F1] Dashboard + QA Integral

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F1-056 | Backend: queries dashboard leads | Diego | 5 | Totales por status/canal/temporal; filtros proyecto+fecha; <100ms |
| F1-057 | Backend: queries dashboard ingresos | Diego | 3 | Sumas correctas por proyecto/mes; coinciden con datos individuales |
| F1-058 | Indices + EXPLAIN ANALYZE top 5 queries | Diego | 2 | Top 5 queries <100ms; indices adicionales si necesario |
| F1-059 | Frontend: dashboard leads con graficas | Diego | 5 | StatCards; grafica temporal linea; barras por canal; pie por status; filtro proyecto |
| F1-060 | Frontend: dashboard ingresos por mes | Diego | 3 | Barras facturado/cobrado/pendiente; selector mes; totales como StatCards |
| F1-061 | QA: flujo E2E completo | Ambos | 5 | Webhook->lead->dossier->seguimiento->conversion->pagos sin errores |
| F1-062 | QA: escenario multi-usuario 3 proy + 4 gestores | Ambos | 3 | Round-robin correcto; aislamiento proyectos; roles diferenciados |
| F1-063 | QA: test carga 50 webhooks simultaneos | Diego | 3 | 0 errores; 0 duplicados; response <500ms |
| F1-064 | QA: revision seguridad endpoints | Angel | 3 | Gestor no ve otros proyectos; Admin no accede SA; tokens expirados 401 |
| F1-065 | QA: verificacion responsive tablet/movil | Angel | 2 | Login, leads, ficha, dashboard usables en 768px y 375px |

### EPIC 8: [F2] Setup Credenciales API

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-001 | Schema api_credentials + encriptacion AES-256 | Diego | 5 | Tabla creada; keys encriptadas AES-256-GCM; funciones encrypt/decrypt testeadas |
| F2-002 | Panel admin: configurar API keys por proyecto | Diego | 5 | Formulario por servicio; keys enmascaradas; solo SA; boton test conexion |
| F2-003 | Crear Facebook App + App Review (ads_read) | Diego | 3 | App creada; review solicitado; documentado |
| F2-004 | System User Meta + token larga duracion | Diego | 2 | System User creado; token generado y encriptado |
| F2-005 | Google Cloud Project + OAuth2 + acceso produccion | Angel | 5 | Proyecto creado; APIs habilitadas; OAuth2 configurado; acceso produccion solicitado |
| F2-006 | GSC: verificar 3 dominios | Angel | 2 | 3 dominios verificados; API funcional; query prueba retorna datos |
| F2-007 | Stripe Restricted Key (solo lectura) | Angel | 1 | Key creada lectura; encriptada en DB; write retorna 403 |
| F2-008 | Claude API key + billing con limite | Angel | 1 | Key creada; billing con limite mensual; encriptada |

### EPIC 9: [F2] Meta Ads API

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-009 | Schema + cron diario pull metricas Meta | Diego | 5 | Tablas creadas; cron 6AM; gasto CRM vs Business Manager <0.5% |
| F2-010 | Retry backoff exponencial error 17 | Diego | 3 | Reintenta 1s,2s,4s,8s,16s; tras 5 fallos alerta email |
| F2-011 | Vinculacion lead<->campaign por utm_campaign | Diego | 3 | Lead con utm_campaign muestra datos campana |
| F2-012 | Frontend: modulo campanas Meta | Diego | 5 | Tabla gasto/clics/CPL/leads CRM; comparativa CPA real vs CPL; selector periodo |

### EPIC 10: [F2] Google Ads API

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-013 | Schema + cron GAQL por MCC + cost_micros | Angel | 5 | Tablas creadas; cost_micros a EUR correcto; gasto CRM = Google Ads dashboard |
| F2-014 | Gestion refresh token + alerta si expira | Angel | 3 | Token expirado detectado; email alerta a SA; error no silenciado |
| F2-015 | Frontend: campanas Google + dashboard consolidado | Angel | 5 | Tabla equivalente Meta; vista consolidada Meta+Google; barras apiladas |

### EPIC 11: [F2] Google Search Console

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-016 | Schema + job diario 7 dias + upsert | Angel | 3 | Tabla creada; job 7 dias; upsert no duplica; datos = GSC dashboard |
| F2-017 | Frontend: trafico organico + consolidada + keywords | Angel | 5 | Clics/impresiones/CTR/posicion; aviso retraso 2-3 dias; grafica consolidada; top 20 keywords |

### EPIC 12: [F2] Stripe Monitor IA

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-018 | Schema + pull Stripe + MRR + churn | Angel | 5 | MRR = suma suscripciones activas; churn correcto; restricted key no puede write |
| F2-019 | Frontend: dashboard IA | Angel | 5 | Solo Admin/SA; MRR/subs/churn cards; evolucion 12 meses |

### EPIC 13: [F2] Audiencias CSV + Reportes Claude

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F2-020 | Export audiencias + SHA256 + CSV Meta | Diego | 5 | CSV con email_sha256/phone_sha256/fn/ln; sube a Meta sin errores |
| F2-021 | Frontend: wizard creacion audiencia | Diego | 5 | 3 pasos: filtros, preview cantidad, descarga CSV |
| F2-022 | Builder JSON + prompt + Claude API | Diego | 8 | JSON estructurado; prompt genera markdown; cifras coherentes; <20k tokens |
| F2-023 | Cron mensual + almacenamiento reportes | Diego | 3 | Dia 1 cada mes 7AM; no regenera historico; reporte en DB |
| F2-024 | Frontend: reportes markdown + Generar + historial | Diego | 5 | Markdown renderizado; historial por proyecto/mes; boton generar manual |

### EPIC 14: [F3] Custom Audiences Meta + Lead Ads Webhook

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F3-001 | Upload Custom Audience Meta API (paginado 10k) | Diego | 8 | 100 leads en BM; 15k paginan sin error; polling estado; resultado en DB |
| F3-002 | Frontend: boton Subir a Meta + estado tiempo real | Diego | 3 | Boton en wizard; estado: preparando/subiendo/procesando/completado; historial |
| F3-003 | Handshake Meta + endpoint POST leadgen | Diego | 5 | Challenge verificacion OK; lead de Testing Tool aparece <5seg; utm_source=meta auto |
| F3-004 | Mapeo campos Meta -> schema CRM + round-robin | Diego | 3 | Campos mapeados; round-robin reutilizado; custom fields en metadata JSON |

### EPIC 15: [F3] Chat Claude AI + Export PDF

| ID | Titulo | Asignado | SP | Criterios de aceptacion |
|---|---|---|---|---|
| F3-005 | Endpoint SSE streaming + context builder + rate limit | Angel | 8 | SSE token a token; pregunta leads = cifra correcta; 21 msg/hora = 429 |
| F3-006 | Frontend: panel lateral chat + preguntas rapidas | Angel | 5 | Panel 400px colapsable; streaming visible; 3 botones pregunta rapida |
| F3-007 | Puppeteer: template HTML + PDF + guardar R2 | Angel | 5 | PDF <5seg; tablas no se cortan; <300MB RAM; almacenado en R2 |
| F3-008 | Frontend: boton Exportar PDF | Angel | 1 | Boton visible; loading durante generacion; descarga automatica |

## INSTRUCCIONES ADICIONALES

1. Crea todas las stories con tipo "Story" (no Task ni Bug)
2. Usa los story points indicados en cada story
3. Los criterios de aceptacion van en la descripcion de cada story como checklist
4. Las labels por fase: `fase-1`, `fase-2`, `fase-3`
5. Las labels por tipo: `backend`, `frontend`, `fullstack`, `config`, `qa`
6. Prioridad: Fase 1 = Highest, Fase 2 = High, Fase 3 = Medium

Crea todo esto paso a paso: primero el proyecto, luego los epics, y finalmente las stories dentro de cada epic.
