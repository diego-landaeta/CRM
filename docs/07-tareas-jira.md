# Tareas Jira - CRM MultiProyecto

> **Proyecto:** CRM MultiProyecto
> **Equipo:** Diego + Angel (fullstack)
> **Total:** 15 Epics, ~97 Stories
> **Duracion estimada:** 6 - 9.5 semanas
> **Metodologia:** Scrum con sprints semanales

---

## Leyenda

| Campo | Descripcion |
|---|---|
| **Tipo** | Backend / Frontend / Fullstack / Config / QA |
| **Story points** | Fibonacci: 1, 2, 3, 5, 8 |
| **AC** | Criterios de aceptacion (todos deben cumplirse para cerrar la story) |

---

# FASE 1 - Core CRM

---

## EPIC: [F1] Setup Infraestructura (Subfase 1.1)

**Asignacion principal:** Ambos
**Dependencias:** Ninguna (punto de partida)
**Semana:** 1

---

### [F1-001] Instalar Node.js LTS, PostgreSQL 16 y PM2 en VPS

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Node v20+ instalado y `node -v` retorna la version correcta
  - [ ] PostgreSQL 16 corriendo en puerto :5432 y `psql --version` funciona
  - [ ] PM2 instalado globalmente y `pm2 -v` retorna la version
- **Notas tecnicas:** Usar nvm para gestionar versiones de Node. Configurar PG con locale UTF-8.

---

### [F1-002] Configurar Nginx: bloque /crm + /crm/api + HTTPS

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] GET /crm carga el HTML del frontend correctamente
  - [ ] GET /crm/api/health llega al proceso Node y retorna 200
  - [ ] HTTPS activo con certificado Certbot (redirect HTTP -> HTTPS)
  - [ ] Recargar /crm/leads (o cualquier ruta SPA) no da 404 (try_files configurado)
- **Notas tecnicas:** Configurar proxy_pass para /crm/api hacia localhost:3001. Usar try_files $uri $uri/ /crm/index.html para SPA fallback.

---

### [F1-003] PM2 ecosystem.config.js + arranque automatico

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] `pm2 start ecosystem.config.js` levanta el proceso crm-api sin errores
  - [ ] Al reiniciar el VPS el proceso arranca solo (pm2 startup + pm2 save)
  - [ ] Logs se escriben en /var/log/pm2/ con rotacion configurada
- **Notas tecnicas:** Configurar max_memory_restart, watch en desarrollo, env variables en ecosystem.

---

### [F1-004] Configurar Cloudflare R2: bucket privado + SDK

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Bucket creado en Cloudflare R2 con acceso privado
  - [ ] Upload de archivo de prueba funciona desde Node con @aws-sdk/client-s3
  - [ ] Pre-signed URL generada permite descarga temporal del archivo
- **Notas tecnicas:** R2 es compatible con S3 SDK. Guardar ACCESS_KEY_ID y SECRET_ACCESS_KEY en .env.

---

### [F1-005] Configurar Brevo: verificar dominio + crear 4 templates

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Dominio verificado en Brevo (DKIM + SPF configurados)
  - [ ] 4 templates creados: bienvenida, notificacion lead, recordatorio, alerta pago
  - [ ] Email de prueba enviado desde Node llega correctamente (no spam)
- **Notas tecnicas:** Usar API v3 de Brevo. Cada template debe tener variables dinamicas ({{nombre}}, {{email}}, etc.).

---

### [F1-006] Inicializar repo Git + estructura carpetas + .gitignore + CI basico

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Repo en GitHub con ramas main y dev creadas
  - [ ] Estructura de carpetas creada (backend/, frontend/, docs/, scripts/)
  - [ ] .gitignore excluye node_modules, .env, dist, uploads
  - [ ] package.json configurado en backend y frontend con scripts basicos
- **Notas tecnicas:** Configurar branch protection en main (requiere PR). Considerar husky para pre-commit hooks.

---

### [F1-007] Ejecutar migracion SQL inicial + seed data

- **Asignado a:** Ambos
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Todas las tablas de Fase 1 creadas correctamente en PostgreSQL
  - [ ] Seed data insertada: superadmin + 6 proyectos de prueba
  - [ ] Conexion desde Node (pg pool) funciona y ejecuta query de prueba
- **Notas tecnicas:** Usar archivos .sql numerados (001_initial.sql, 002_seed.sql). Verificar que FKs y constraints estan activos.

---

### [F1-008] Script backup pg_dump diario a R2 + cron

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Script genera dump con pg_dump, comprime con gzip
  - [ ] Archivo comprimido se sube a R2 con nombre que incluye fecha (crm_backup_YYYYMMDD.sql.gz)
  - [ ] Cron configurado a las 3:00 AM diario
  - [ ] Backup de prueba verificado en R2 (descargable y restaurable)
- **Notas tecnicas:** Retener ultimos 30 backups. Script debe enviar alerta si falla el upload.

---

## EPIC: [F1] Auth + Roles + Panel Usuarios (Subfase 1.2)

**Asignacion principal:** Diego
**Dependencias:** F1 Setup Infraestructura (1.1)
**Semana:** 1

---

### [F1-009] Schema DB: tablas users, projects, user_projects

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Tablas users, projects y user_projects creadas con todos los campos del esquema
  - [ ] Foreign keys y constraints funcionan (ON DELETE RESTRICT)
  - [ ] UNIQUE constraint en users.email activo (insert duplicado falla)
- **Notas tecnicas:** users.role: superadmin, admin, gestor. user_projects vincula N:M con campo role_in_project.

---

### [F1-010] Endpoints auth: POST login, logout, refresh

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] POST /auth/login con credenciales validas devuelve accessToken en body + setea refreshToken en cookie httpOnly
  - [ ] POST /auth/logout limpia la cookie y el refresh token en DB
  - [ ] POST /auth/refresh genera nuevo accessToken si refreshToken es valido
  - [ ] Token expirado en cualquier endpoint retorna 401 Unauthorized
- **Notas tecnicas:** Usar bcrypt para comparar passwords. Refresh token almacenado hasheado en DB.

---

### [F1-011] JWT access (15min) + refresh token (30d) httpOnly cookie

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Access token expira en exactamente 15 minutos (verificable con jwt.io)
  - [ ] Refresh token se setea como cookie httpOnly, Secure, SameSite=Strict con maxAge 30 dias
  - [ ] Al hacer logout el refresh token se invalida en DB y no puede reutilizarse
- **Notas tecnicas:** Payload del access token: { userId, email, role, activeProjectId }. Secreto JWT en variable de entorno.

---

### [F1-012] Middleware roleGuard + projectAccess

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Gestor que intenta acceder a ruta de Admin recibe 403 Forbidden
  - [ ] Gestor que intenta ver leads de proyecto no asignado recibe 403 Forbidden
  - [ ] Admin accede a todos los endpoints de sus proyectos asignados
  - [ ] Superadmin accede a todo sin restriccion
- **Notas tecnicas:** roleGuard como middleware Express que recibe roles permitidos. projectAccess verifica user_projects.

---

### [F1-013] CRUD usuarios + envio email bienvenida Brevo

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] POST /users crea usuario y envia email de bienvenida con link set-password
  - [ ] Link contiene token unico que expira en 24 horas
  - [ ] GET /users lista usuarios con filtros (activo/inactivo, rol, proyecto)
  - [ ] PATCH /users/:id permite editar nombre, rol y proyectos asignados
  - [ ] DELETE (soft) /users/:id desactiva usuario (is_active = false)
- **Notas tecnicas:** Solo Admin y Superadmin pueden crear usuarios. Email se envia via API Brevo con template de bienvenida.

---

### [F1-014] Endpoint set-password con token unico

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] POST /auth/set-password con token valido permite setear password
  - [ ] Token expirado (>24h) retorna error 400 con mensaje descriptivo
  - [ ] Token ya utilizado retorna error 400 (no se puede reutilizar)
  - [ ] Password se hashea con bcrypt con salt rounds = 12
- **Notas tecnicas:** Token almacenado como hash en DB. Marcar token como used tras uso exitoso.

---

### [F1-015] Tabla user_activity_log + registro automatico

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Login, logout y cambios de rol se registran automaticamente
  - [ ] Cada registro incluye user_id, accion, IP del cliente y timestamp
  - [ ] Endpoint GET /admin/activity-log lista eventos con paginacion
- **Notas tecnicas:** Usar middleware para capturar IP (req.ip o x-forwarded-for). Considerar particionado por fecha si crece mucho.

---

### [F1-016] Frontend: pantalla login (email + password)

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Formulario con campos email y password con validacion en cliente
  - [ ] Error visible si credenciales son incorrectas (mensaje generico por seguridad)
  - [ ] Redirect automatico a dashboard tras login exitoso
  - [ ] Responsive: usable en desktop, tablet y movil
- **Notas tecnicas:** Usar React Hook Form + Zod para validacion. Deshabilitar boton durante request.

---

### [F1-017] Frontend: AuthContext + ProjectSelector en navbar

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] AuthContext provee user, role y funciones login/logout a toda la app
  - [ ] ProjectSelector en navbar muestra solo proyectos asignados al usuario
  - [ ] Proyecto activo persiste en localStorage y se restaura al recargar
  - [ ] Cambiar proyecto activo recarga los datos del contexto (leads, dashboard, etc.)
- **Notas tecnicas:** Usar React Context + useReducer. ProjectSelector como dropdown con nombre del proyecto y logo.

---

### [F1-018] Frontend: panel admin usuarios (tabla + formulario crear/editar)

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla con columnas: nombre, email, rol, proyectos, ultimo acceso, estado
  - [ ] Formulario crear usuario con checkboxes de proyectos asignables
  - [ ] Editar rol funciona inline o via dialog
  - [ ] Desactivar usuario requiere confirmacion antes de ejecutar
- **Notas tecnicas:** Solo visible para Admin/Superadmin. Usar TanStack Table para la tabla. Dialog con shadcn/ui.

---

### [F1-019] Frontend: pantalla set-password desde enlace email

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Pantalla con campo password + confirmacion de password
  - [ ] Validacion de fuerza minima (8 chars, 1 mayuscula, 1 numero)
  - [ ] Mensaje de exito tras setear password + redirect a login en 3 segundos
- **Notas tecnicas:** Extraer token de la URL (query param). Mostrar error si token es invalido o expirado.

---

## EPIC: [F1] Productos + Dossiers PDF (Subfase 1.3)

**Asignacion principal:** Angel
**Dependencias:** F1 Setup Infraestructura (1.1)
**Semana:** 1

---

### [F1-020] Schema DB: tablas products, dossiers

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Tablas products y dossiers creadas con todos los campos
  - [ ] Foreign keys a projects y users funcionan correctamente
  - [ ] Constraint UNIQUE en (project_id, product_name) activo
- **Notas tecnicas:** dossiers tiene campo version (integer, autoincremento por producto) y status (active/inactive).

---

### [F1-021] CRUD productos por proyecto

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Crear, listar, editar y desactivar productos funciona correctamente
  - [ ] Filtro por projectId retorna solo productos de ese proyecto
  - [ ] Usuario solo puede ver/gestionar productos de proyectos asignados
- **Notas tecnicas:** Soft delete (is_active = false). Incluir campo precio, descripcion_corta, producto_tipo.

---

### [F1-022] Upload PDF a R2 con nombre unico (uuid+timestamp)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] PDF se sube correctamente a R2 con nombre formato uuid-timestamp.pdf
  - [ ] Archivos mayores a 5MB suben sin error (limite configurado a 20MB)
  - [ ] Solo acepta archivos con MIME type application/pdf (otros retornan 400)
  - [ ] Registro en tabla dossiers con r2_key, size, uploaded_by
- **Notas tecnicas:** Usar multer para multipart upload. Validar MIME type tanto por extension como por magic bytes.

---

### [F1-023] Endpoint pre-signed URL (15min, solo autenticados)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] GET /dossiers/:id/url retorna URL pre-firmada valida durante 15 minutos
  - [ ] URL expirada retorna acceso denegado de R2
  - [ ] Usuario no autenticado no puede obtener la URL (401)
- **Notas tecnicas:** Usar getSignedUrl de @aws-sdk/s3-request-presigner. Loguear cada acceso para auditoria.

---

### [F1-024] Historial versiones dossier (nueva version no borra anterior)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Subir nueva version marca la anterior como status = 'inactive'
  - [ ] Historial muestra todas las versiones con fecha, usuario y tamano
  - [ ] La version activa siempre es la mas reciente (version mas alta)
- **Notas tecnicas:** Campo version se autocalcula como MAX(version) + 1 para ese product_id.

---

### [F1-025] Frontend: panel gestion productos por proyecto

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Lista productos del proyecto activo con nombre, tipo, precio y estado
  - [ ] Crear y editar producto via dialog modal con validacion
  - [ ] Desactivar producto requiere confirmacion (dialog)
  - [ ] Indicador visual si el producto tiene dossier asociado (icono PDF)
- **Notas tecnicas:** Usar DataTable con sorting y filtros. Mostrar badge "Sin dossier" para productos sin PDF.

---

### [F1-026] Frontend: upload dossier drag&drop + indicador version

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Zona drag&drop funcional (acepta PDF, rechaza otros formatos visualmente)
  - [ ] Barra de progreso visible durante el upload
  - [ ] Muestra version actual del dossier con fecha y usuario que lo subio
  - [ ] Historial de versiones desplegable en acordeon con opcion de descarga
- **Notas tecnicas:** Usar react-dropzone. Mostrar preview del nombre del archivo antes de confirmar upload.

---

## EPIC: [F1] Webhook + UTMs + Round-robin (Subfase 1.4)

**Asignacion principal:** Diego
**Dependencias:** F1 Auth (1.2), F1 Productos (1.3)
**Semana:** 2

---

### [F1-027] Schema DB: leads, lead_utms, project_queue_state

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Tablas leads, lead_utms y project_queue_state creadas con todos los campos
  - [ ] Indices creados en email, project_id, (responsable_id, status)
  - [ ] Constraint CHECK en leads.status con valores validos del pipeline
- **Notas tecnicas:** leads.status: nuevo, contactado, en_seguimiento, visitado, convertido, descartado. project_queue_state almacena last_assigned_index por proyecto.

---

### [F1-028] Endpoint POST /webhooks/leads/:slug con validacion API key

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] API key invalida o ausente retorna 401 Unauthorized
  - [ ] Payload valido crea lead en DB y retorna 201 con lead_id
  - [ ] Tiempo de respuesta del webhook < 500ms (procesamiento pesado es asincrono)
  - [ ] Payload invalido (sin email o sin nombre) retorna 400 con errores de validacion
- **Notas tecnicas:** :slug identifica al proyecto. API key en header X-API-Key. Validar con Joi o Zod.

---

### [F1-029] Parseo UTMs desde landing_url + deteccion canal automatica

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] UTMs (source, medium, campaign, term, content) extraidos de la URL y guardados en lead_utms
  - [ ] Canal detectado automaticamente segun reglas: utm_source=facebook/instagram -> meta, utm_source=google+medium=cpc -> google_ads, sin UTMs -> organico/directo
  - [ ] Canal 'chatgpt' detectado cuando utm_source contiene 'chatgpt' o referrer es chatgpt.com
- **Notas tecnicas:** Usar URL API de Node para parsear query params. Tabla de reglas de deteccion configurable.

---

### [F1-030] Deteccion duplicados por email + vinculacion

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Lead con email existente en mismo proyecto crea nuevo registro con lead_duplicado_de apuntando al original
  - [ ] Mismo proyecto + mismo producto marca campo reincidente = true
  - [ ] Lead con email existente en diferente proyecto se crea sin vinculacion (proyectos aislados)
- **Notas tecnicas:** Busqueda de duplicados por email normalizado (lowercase, trim). El lead original no se modifica.

---

### [F1-031] Round-robin transaccional PostgreSQL

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 8
- **Criterios de aceptacion:**
  - [ ] Con 2 gestores activos, 3 leads se asignan A, B, A (rotacion equitativa)
  - [ ] Gestor inactivo o sin acceso al proyecto se salta en la rotacion
  - [ ] Toda la operacion ejecuta en una transaccion PostgreSQL (BEGIN/COMMIT)
  - [ ] Test de concurrencia con 50 requests simultaneos completa con 0 errores y 0 asignaciones duplicadas
- **Notas tecnicas:** Usar SELECT ... FOR UPDATE en project_queue_state para evitar race conditions. La tabla almacena el indice del ultimo gestor asignado.

---

### [F1-032] Notificacion Brevo asincrona al gestor asignado

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Email llega al gestor asignado en menos de 10 segundos tras la creacion del lead
  - [ ] Email contiene datos del lead (nombre, email, telefono) + enlace directo a la ficha
  - [ ] El webhook responde 201 ANTES de enviar el email (envio asincrono)
- **Notas tecnicas:** Usar setImmediate o una cola simple para desacoplar el envio. Template Brevo con variables dinamicas.

---

### [F1-033] CORS configurado por dominio de proyecto (no wildcard)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Request desde dominio registrado del proyecto funciona (Access-Control-Allow-Origin correcto)
  - [ ] Request desde dominio no autorizado es rechazado por CORS
  - [ ] Lista de dominios permitidos se obtiene de la tabla projects.allowed_origins
- **Notas tecnicas:** Usar cors middleware con origin como funcion que consulta DB (con cache en memoria).

---

### [F1-034] Indices PostgreSQL optimizados para leads

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Indice en leads.email (btree) creado
  - [ ] Indice compuesto en (project_id, status) creado
  - [ ] Indice compuesto en (responsable_id, status) creado
  - [ ] Indice en leads.fecha_solicitud creado
- **Notas tecnicas:** Verificar con EXPLAIN ANALYZE que las queries principales usan los indices.

---

### [F1-035] Frontend: lista leads con filtros (proyecto, status, responsable, canal, fecha)

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Filtros de proyecto, status, responsable, canal y rango de fechas funcionan combinados
  - [ ] Paginacion server-side funciona correctamente (20 items por pagina)
  - [ ] Gestor solo ve leads de sus proyectos asignados
  - [ ] Busqueda por nombre o email del lead funciona
- **Notas tecnicas:** Usar query params en URL para que los filtros sean compartibles. Debounce en busqueda de texto (300ms).

---

### [F1-036] Frontend: vista pipeline por status (columnas arrastrables)

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] 6 columnas correspondientes a los status del pipeline
  - [ ] Leads representados como cards con nombre, email, canal y fecha
  - [ ] Toggle para alternar entre vista lista y vista pipeline
  - [ ] Contadores de leads por columna actualizados en tiempo real
- **Notas tecnicas:** Usar @dnd-kit/sortable para drag&drop. Drag entre columnas actualiza status via PATCH.

---

### [F1-037] Frontend: badge duplicados + alerta inactividad

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Badge "Duplicado" visible en leads que tienen lead_duplicado_de (con link al original)
  - [ ] Alerta amarilla en leads sin actividad (sin interacciones) hace mas de N dias (configurable)
  - [ ] Badge "Reincidente" visible si el lead es reincidente en mismo producto
- **Notas tecnicas:** N dias configurable por proyecto (default 3 dias). Usar tooltip para mostrar detalle del duplicado.

---

## EPIC: [F1] Ficha Lead + Historial + Seguimiento (Subfase 1.5)

**Asignacion principal:** Angel
**Dependencias:** F1 Webhook (1.4)
**Semana:** 2

---

### [F1-038] Schema DB: lead_status_history, lead_interactions, lead_reminders

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Tablas lead_status_history, lead_interactions y lead_reminders creadas
  - [ ] Foreign keys a leads y users funcionan correctamente
  - [ ] Indices en lead_id para las tres tablas creados
- **Notas tecnicas:** lead_interactions.tipo: llamada, email, whatsapp, nota. lead_reminders incluye campos fecha, nota, is_completed.

---

### [F1-039] PATCH /leads/:id/status con registro automatico en historial

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Cambio de status crea registro en lead_status_history con usuario, timestamp, status anterior y nuevo
  - [ ] Status anterior y nuevo son correctos y coherentes
  - [ ] Solo gestores asignados al proyecto o Admin/SA pueden cambiar status
- **Notas tecnicas:** Validar que el status nuevo es un valor valido del enum. Registrar en una sola transaccion.

---

### [F1-040] POST /leads/:id/interactions (llamada/email/whatsapp/nota)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Crear interaccion con tipo (llamada/email/whatsapp/nota), texto y fecha funciona
  - [ ] GET /leads/:id/interactions lista interacciones ordenadas por fecha DESC
  - [ ] Solo usuarios con acceso al proyecto del lead pueden crear interacciones
- **Notas tecnicas:** Campo texto es obligatorio (minimo 5 caracteres). Fecha por defecto es NOW().

---

### [F1-041] POST /leads/:id/reminders + cron diario de notificacion

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Crear recordatorio con fecha futura y nota funciona correctamente
  - [ ] Cron diario (8:00 AM) detecta recordatorios de hoy y envia email Brevo al responsable
  - [ ] PATCH /reminders/:id/complete marca como completado con fecha de completado
  - [ ] Recordatorio ya completado no se notifica de nuevo
- **Notas tecnicas:** Cron con node-cron. Email incluye datos del lead + enlace directo a la ficha.

---

### [F1-042] Reasignacion manual de lead (solo Admin/Superadmin)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Gestor que intenta reasignar recibe 403 Forbidden
  - [ ] Admin/Superadmin puede reasignar a cualquier gestor activo del mismo proyecto
  - [ ] Reasignacion queda registrada en lead_status_history como evento de tipo 'reasignacion'
- **Notas tecnicas:** Endpoint PATCH /leads/:id/reassign con body { new_responsable_id }. Verificar que el nuevo gestor tiene acceso al proyecto.

---

### [F1-043] Frontend: ficha lead completa (datos + UTMs + canal + campana)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Muestra todos los datos del lead: nombre, email, telefono, mensaje, fecha solicitud
  - [ ] Seccion UTMs visible con source, medium, campaign, term, content
  - [ ] Canal detectado mostrado con icono correspondiente (Meta, Google, Organico, etc.)
  - [ ] Badge "Duplicado" visible si aplica, con enlace al lead original
- **Notas tecnicas:** Layout en dos columnas: datos principales a la izquierda, timeline a la derecha. Responsive a una columna en movil.

---

### [F1-044] Frontend: selector de status con confirmacion

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Dialog de confirmacion aparece antes de ejecutar el cambio de status
  - [ ] Si cambia a "Convertido", redirige automaticamente al formulario de conversion
  - [ ] Status actual resaltado visualmente en el selector
- **Notas tecnicas:** Usar Select de shadcn/ui con AlertDialog para confirmacion. Mostrar icono de color por status.

---

### [F1-045] Frontend: timeline de interacciones (scroll vertical)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Timeline vertical con iconos por tipo (telefono para llamada, sobre para email, icono WhatsApp, nota para nota)
  - [ ] Cada entrada muestra fecha, hora, usuario que la creo y texto de la nota
  - [ ] Ordenada cronologicamente (mas reciente arriba)
  - [ ] Boton para agregar nueva interaccion con formulario rapido
- **Notas tecnicas:** Componente reutilizable. Scroll infinito o paginacion si hay mas de 50 interacciones.

---

### [F1-046] Frontend: boton dossier (preview/copiar enlace) + checkbox enviado

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Si el lead tiene producto_interes con dossier asociado, boton de dossier es visible
  - [ ] "Copiar enlace" copia la URL pre-firmada al clipboard con feedback visual
  - [ ] Checkbox "Dossier enviado" registra la fecha de envio al marcarse
- **Notas tecnicas:** URL pre-firmada se regenera cada vez (15min de vida). Mostrar nombre del dossier y version actual.

---

### [F1-047] Frontend: formulario recordatorio (datepicker + nota)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] DatePicker funcional que no permite seleccionar fechas pasadas
  - [ ] Campo nota opcional con placeholder descriptivo
  - [ ] Recordatorio creado aparece inmediatamente en la lista de recordatorios del lead
- **Notas tecnicas:** Usar DatePicker de shadcn/ui. Mostrar recordatorios pendientes con badge en la ficha del lead.

---

### [F1-048] Frontend: vista historial duplicado (timeline del lead original)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Si lead_duplicado_de tiene valor, seccion "Historial previo" es visible
  - [ ] Muestra las interacciones del lead original en formato timeline resumido
  - [ ] Link directo al lead original para navegar rapidamente
- **Notas tecnicas:** Seccion colapsable por defecto. Cargar datos del lead original con lazy loading.

---

## EPIC: [F1] Conversiones y Pagos (Subfase 1.6)

**Asignacion principal:** Angel
**Dependencias:** F1 Ficha Lead (1.5)
**Semana:** 2-3

---

### [F1-049] Schema DB: conversions, conversion_payments

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Tablas conversions y conversion_payments creadas con todos los campos
  - [ ] Foreign keys a leads, products y users funcionan correctamente
  - [ ] Campo importe_pendiente calculado como importe_total - importe_pagado
- **Notas tecnicas:** conversions: lead_id, product_id, importe_total, importe_pagado, fecha_compromiso_pago, metodo_pago, notas. conversion_payments: conversion_id, importe, fecha_pago, metodo.

---

### [F1-050] Registrar conversion (auto cambia status a Convertido)

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] POST /conversions crea registro de conversion vinculado al lead
  - [ ] Al crear la conversion, lead.status cambia automaticamente a 'convertido'
  - [ ] Cambio de status queda registrado en lead_status_history
- **Notas tecnicas:** Toda la operacion en una transaccion. Validar que el lead no tenga ya una conversion activa.

---

### [F1-051] Agregar abono parcial + recalculo pendiente

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] POST /conversions/:id/payments agrega un pago parcial
  - [ ] importe_pagado de la conversion se actualiza automaticamente (suma de payments)
  - [ ] importe_pendiente recalculado = importe_total - importe_pagado
  - [ ] No se permite agregar pago que exceda el importe pendiente
- **Notas tecnicas:** Cada payment es inmutable (no se edita ni borra). Validar importe > 0.

---

### [F1-052] Cron pagos vencidos + notificacion email

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Cron diario (9:00 AM) detecta conversiones con fecha_compromiso_pago < hoy y pendiente > 0
  - [ ] Envia email al responsable del lead con datos de la conversion y monto pendiente
  - [ ] No envia duplicado si ya se notifico hoy (control con campo last_reminder_sent)
- **Notas tecnicas:** Template Brevo de alerta de pago. Incluir enlace directo a la ficha del lead.

---

### [F1-053] Frontend: formulario conversion (desplegable al marcar Convertido)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Formulario con campos: producto, importe total, importe pagado inicial, fecha compromiso pago, metodo pago, notas
  - [ ] Validacion: importe total > 0, fecha compromiso no puede ser pasada, producto obligatorio
  - [ ] Al guardar, el lead pasa a Convertido y se muestra confirmacion
- **Notas tecnicas:** Se despliega automaticamente al cambiar status a "Convertido". Usar Sheet o Dialog de shadcn/ui.

---

### [F1-054] Frontend: dashboard pagos pendientes con alertas

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Lista con nombre del lead, importe pendiente, fecha compromiso y responsable
  - [ ] Badge rojo en conversiones con fecha vencida
  - [ ] Badge amarillo en conversiones que vencen en menos de 3 dias
  - [ ] Filtrable por proyecto y responsable
- **Notas tecnicas:** Ordenar por fecha compromiso ASC (mas urgentes primero). Click en fila navega a ficha del lead.

---

### [F1-055] Frontend: vista ingresos por proyecto (facturado/cobrado/pendiente)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Totales por proyecto: facturado (importe_total), cobrado (importe_pagado), pendiente
  - [ ] Filtrable por mes (selector de mes/anio)
  - [ ] Tabla con desglose por conversion individual
- **Notas tecnicas:** Usar cards con numeros grandes para los totales. Grafica de barras apiladas opcional.

---

## EPIC: [F1] Dashboard + QA Integral (Subfase 1.7)

**Asignacion principal:** Diego (Dashboard) + Ambos (QA)
**Dependencias:** Todas las subfases anteriores de F1
**Semana:** 3

---

### [F1-056] Backend: queries dashboard leads (por proyecto/status/canal/temporal)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Queries devuelven totales correctos de leads por status, canal y temporalidad
  - [ ] Filtros por proyecto y rango de fechas funcionan combinados
  - [ ] Performance de cada query < 100ms (verificado con EXPLAIN ANALYZE)
- **Notas tecnicas:** Endpoints: GET /dashboard/leads/summary, /dashboard/leads/by-status, /dashboard/leads/by-channel, /dashboard/leads/timeline. Usar CTEs para queries complejas.

---

### [F1-057] Backend: queries dashboard ingresos (facturado/cobrado/pendiente)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Sumas correctas por proyecto y mes de facturado, cobrado y pendiente
  - [ ] Totales coinciden con la suma individual de conversiones (verificado con test)
  - [ ] Endpoint soporta filtro por proyecto_id y rango de meses
- **Notas tecnicas:** Endpoint: GET /dashboard/revenue. Usar GROUP BY month con date_trunc.

---

### [F1-058] Indices adicionales + EXPLAIN ANALYZE top 5 queries

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Las 5 queries mas pesadas del dashboard ejecutan en < 100ms
  - [ ] Indices adicionales creados si alguna query supera el umbral
  - [ ] Documento con resultados de EXPLAIN ANALYZE guardado en docs/
- **Notas tecnicas:** Probar con al menos 1000 leads y 200 conversiones de seed data para simular carga real.

---

### [F1-059] Frontend: dashboard leads con graficas (Recharts)

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] StatCards con totales: leads hoy, esta semana, este mes, tasa conversion
  - [ ] Grafica temporal de linea (leads por dia/semana/mes)
  - [ ] Grafica de barras por canal (Meta, Google, Organico, Directo, ChatGPT)
  - [ ] Grafica pie por status actual del pipeline
  - [ ] Selector de proyecto filtra todas las graficas simultaneamente
- **Notas tecnicas:** Usar Recharts con ResponsiveContainer. Colores consistentes por canal y status.

---

### [F1-060] Frontend: dashboard ingresos filtrable por mes

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Grafica de barras con facturado/cobrado/pendiente por proyecto
  - [ ] Selector de mes/anio funcional
  - [ ] Totales generales visibles como StatCards encima de la grafica
- **Notas tecnicas:** Usar BarChart de Recharts con barras agrupadas. Colores: verde (cobrado), azul (facturado), rojo (pendiente).

---

### [F1-061] QA: flujo E2E completo webhook -> lead -> dossier -> seguimiento -> conversion -> pagos

- **Asignado a:** Ambos
- **Tipo:** QA
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Webhook recibe lead, se crea correctamente con UTMs y canal detectado
  - [ ] Lead aparece en lista, ficha muestra todos los datos
  - [ ] Agregar interacciones, cambiar status, crear conversion y registrar pagos funciona sin errores
  - [ ] Todos los datos persisten correctamente en DB tras cada paso
  - [ ] Dashboard refleja los datos correctamente
- **Notas tecnicas:** Documentar cada paso del flujo con capturas. Probar con al menos 3 proyectos diferentes.

---

### [F1-062] QA: escenario multi-usuario 3 proyectos + 4 gestores

- **Asignado a:** Ambos
- **Tipo:** QA
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Round-robin asigna correctamente entre los gestores de cada proyecto
  - [ ] Aislamiento de proyectos verificado: gestor solo ve leads de sus proyectos
  - [ ] Roles funcionan correctamente: gestor, admin y superadmin con permisos diferenciados
- **Notas tecnicas:** Crear escenario con 3 proyectos, 4 gestores (2 compartidos entre proyectos). Probar con sesiones simultaneas.

---

### [F1-063] QA: test de carga 50 webhooks simultaneos

- **Asignado a:** Diego
- **Tipo:** QA
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] 50 webhooks simultaneos procesados con 0 errores
  - [ ] 0 duplicados no deseados en round-robin (cada lead asignado a un solo gestor)
  - [ ] Tiempo de respuesta promedio < 500ms
- **Notas tecnicas:** Usar Artillery o script con Promise.all + fetch. Verificar en DB que la asignacion round-robin es correcta.

---

### [F1-064] QA: revision seguridad - ningun endpoint filtra datos no autorizados

- **Asignado a:** Angel
- **Tipo:** QA
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Gestor no puede ver leads de proyectos no asignados (403)
  - [ ] Admin no puede acceder a funciones exclusivas de Superadmin (403)
  - [ ] Tokens expirados son rechazados consistentemente (401)
  - [ ] Intentar acceder a recurso de otro usuario retorna 403
- **Notas tecnicas:** Probar cada endpoint con tokens de diferentes roles. Documentar cualquier fallo encontrado.

---

### [F1-065] QA: verificacion responsive tablet y movil

- **Asignado a:** Angel
- **Tipo:** QA
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] Login usable en tablet (768px) y movil (375px)
  - [ ] Lista de leads usable con scroll horizontal en movil
  - [ ] Ficha de lead usable en una columna en movil
  - [ ] Dashboard graficas se adaptan al ancho disponible
- **Notas tecnicas:** Probar en Chrome DevTools con dispositivos: iPad, iPhone 12, Galaxy S21. Documentar issues encontrados.

---

# FASE 2 - Integraciones Externas

---

## EPIC: [F2] Setup Credenciales API (Subfase 2.1)

**Asignacion principal:** Ambos
**Dependencias:** Fase 1 completa
**Semana:** 4

---

### [F2-001] Schema DB api_credentials + encriptacion AES-256

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla api_credentials creada con campos: project_id, service, encrypted_key, iv, created_at
  - [ ] Keys se almacenan encriptadas con AES-256-GCM (nunca en texto plano)
  - [ ] Funciones encrypt/decrypt testeadas unitariamente con valores conocidos
- **Notas tecnicas:** Clave maestra en variable de entorno (ENCRYPTION_KEY). Usar crypto.createCipheriv con iv aleatorio por registro.

---

### [F2-002] Panel admin: configurar API keys por proyecto

- **Asignado a:** Diego
- **Tipo:** Fullstack
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Formulario para ingresar API keys de cada servicio por proyecto
  - [ ] Keys se muestran enmascaradas (****xxxx) tras guardar, nunca en texto plano
  - [ ] Solo Superadmin puede ver y editar las credenciales
  - [ ] Boton "Test conexion" valida que la key funciona antes de guardar
- **Notas tecnicas:** Servicios: meta_ads, google_ads, gsc, stripe, claude, brevo. Validar formato de cada key.

---

### [F2-003] Crear Facebook App + solicitar App Review (ads_read)

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Facebook App creada en Meta for Developers con permisos ads_read
  - [ ] App Review solicitado con justificacion y screencasts
  - [ ] App en estado "Live" o en proceso de review documentado
- **Notas tecnicas:** Si App Review tarda, usar Development Mode con System User mientras se aprueba.

---

### [F2-004] System User Meta + token larga duracion

- **Asignado a:** Diego
- **Tipo:** Config
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] System User creado en Business Manager con rol de Admin
  - [ ] Token de larga duracion generado (60 dias) y almacenado encriptado
  - [ ] Alerta configurada para renovar token 7 dias antes de expirar
- **Notas tecnicas:** System User tokens no expiran si la app no cambia permisos. Documentar proceso de renovacion.

---

### [F2-005] Google Cloud Project + OAuth2 + acceso produccion Ads API

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Proyecto creado en Google Cloud Console con APIs habilitadas (Ads, GSC, OAuth2)
  - [ ] OAuth2 configurado con redirect URI y consent screen
  - [ ] Acceso a produccion de Google Ads API solicitado (o Developer Token obtenido)
- **Notas tecnicas:** Necesario: Client ID, Client Secret, Developer Token, Refresh Token. Documentar proceso de obtencion paso a paso.

---

### [F2-006] GSC: verificar 3 dominios + Search Console API

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 2
- **Criterios de aceptacion:**
  - [ ] 3 dominios de proyectos verificados en Google Search Console
  - [ ] API Search Console habilitada y funcional con las credenciales OAuth2
  - [ ] Query de prueba desde Node retorna datos correctos
- **Notas tecnicas:** Verificacion por DNS TXT record o meta tag HTML. Usar google-auth-library para autenticacion.

---

### [F2-007] Stripe Restricted Key (solo lectura)

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Restricted API key creada con permisos de solo lectura (subscriptions:read, charges:read)
  - [ ] Key almacenada encriptada en api_credentials
  - [ ] Intentar hacer un write con esta key retorna 403 (verificado)
- **Notas tecnicas:** Crear en Stripe Dashboard > Developers > API Keys > Restricted Keys.

---

### [F2-008] Claude API key + configurar billing con limite

- **Asignado a:** Angel
- **Tipo:** Config
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] API key creada en console.anthropic.com
  - [ ] Billing configurado con limite mensual de gasto (ej. $50/mes)
  - [ ] Key almacenada encriptada en api_credentials
- **Notas tecnicas:** Usar modelo claude-sonnet para reportes (balance costo/calidad). Configurar alertas de billing.

---

## EPIC: [F2] Meta Ads API (Subfase 2.2)

**Asignacion principal:** Diego
**Dependencias:** F2 Setup Credenciales (2.1)
**Semana:** 4-5

---

### [F2-009] Schema + Job cron diario pull metricas Meta

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla meta_campaigns y meta_daily_metrics creadas con campos necesarios
  - [ ] Job cron diario (6:00 AM) descarga metricas de campanas activas de ayer
  - [ ] Gasto registrado en CRM vs Business Manager tiene diferencia < 0.5%
  - [ ] Metricas incluyen: spend, impressions, clicks, cpc, cpm, conversions
- **Notas tecnicas:** Usar Marketing API v18+. Nivel de granularidad: campana + dia. Upsert para evitar duplicados si el job se ejecuta dos veces.

---

### [F2-010] Retry backoff exponencial error 17 (rate limit)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Al recibir error 17 (User request limit reached), el job reintenta con backoff exponencial
  - [ ] Backoff: 1s, 2s, 4s, 8s, 16s (maximo 5 reintentos)
  - [ ] Tras 5 reintentos fallidos, el job registra error y envia alerta por email
- **Notas tecnicas:** Implementar como wrapper reutilizable para cualquier llamada a Meta API. Loguear cada reintento.

---

### [F2-011] Vinculacion lead <-> campaign por utm_campaign

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Lead con utm_campaign que coincide con campaign_name de Meta muestra datos de campana
  - [ ] Vinculacion es por nombre exacto o ID de campana (configurable)
  - [ ] Endpoint /leads/:id incluye datos de campana si hay vinculacion
- **Notas tecnicas:** Busqueda por utm_campaign en lead_utms contra meta_campaigns.campaign_name. Cache en memoria para campanas.

---

### [F2-012] Frontend: modulo campanas Meta + selector periodo

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla con campanas: nombre, gasto, clics, CPL, leads CRM, conversiones CRM
  - [ ] Comparativa CPA real (gasto/conversiones CRM) vs CPL Meta (gasto/clics)
  - [ ] Selector de periodo (ultimos 7, 14, 30 dias, custom)
  - [ ] Filtro por proyecto
- **Notas tecnicas:** Calcular metricas CRM cruzando meta_campaigns con leads (por utm_campaign). Resaltar campanas con CPA > umbral.

---

## EPIC: [F2] Google Ads API (Subfase 2.3)

**Asignacion principal:** Angel
**Dependencias:** F2 Setup Credenciales (2.1)
**Semana:** 5

---

### [F2-013] Schema + Job cron diario GAQL por MCC + conversion cost_micros

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla google_campaigns y google_daily_metrics creadas
  - [ ] Job cron diario ejecuta GAQL query por cada cuenta MCC vinculada
  - [ ] cost_micros convertido correctamente a EUR (dividir entre 1.000.000)
  - [ ] Gasto en CRM coincide con el dashboard de Google Ads
- **Notas tecnicas:** Usar google-ads-api npm package. GAQL: SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions FROM campaign WHERE segments.date = 'YYYY-MM-DD'.

---

### [F2-014] Gestion refresh token + notificacion si expira

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Si el refresh token de Google expira o es revocado, el job detecta el error
  - [ ] Superadmin recibe email de alerta inmediato con instrucciones para re-autorizar
  - [ ] Error no se silencia: queda registrado en logs y en tabla de alertas
- **Notas tecnicas:** Google refresh tokens pueden expirar si el usuario revoca acceso o si la app pierde verificacion. Implementar health check periodico.

---

### [F2-015] Frontend: modulo campanas Google + dashboard consolidado Meta+Google

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla de campanas Google equivalente a la de Meta (gasto, clics, CPL, leads CRM)
  - [ ] Vista consolidada con gasto total Meta + Google por proyecto y mes
  - [ ] Grafica de barras apiladas (Meta vs Google) por periodo
- **Notas tecnicas:** Reutilizar componente de tabla de campanas. Consolidado usa un endpoint que agrega ambas fuentes.

---

## EPIC: [F2] Google Search Console (Subfase 2.4)

**Asignacion principal:** Angel
**Dependencias:** F2 Setup Credenciales (2.1)
**Semana:** 5-6

---

### [F2-016] Schema + Job diario 7 dias + upsert

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Tabla gsc_daily_metrics creada con campos: domain, date, query, clicks, impressions, ctr, position
  - [ ] Job diario descarga datos de los ultimos 7 dias (GSC tiene retraso de 2-3 dias)
  - [ ] Upsert por (domain, date, query): no duplica registros si el job se ejecuta multiples veces
  - [ ] Datos coinciden con el dashboard de Google Search Console
- **Notas tecnicas:** Usar searchanalytics.query de Search Console API. Dimensiones: query, date. Rows limit: 25000.

---

### [F2-017] Frontend: modulo trafico organico + grafica consolidada + top keywords

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Metricas mostradas: clics, impresiones, CTR medio, posicion media
  - [ ] Aviso visible: "Datos con retraso de 2-3 dias" con fecha de ultima actualizacion
  - [ ] Grafica consolidada: trafico organico + trafico pago + leads en el mismo periodo
  - [ ] Tabla top 20 keywords ordenadas por clics con posicion media
- **Notas tecnicas:** Usar LineChart de Recharts para tendencia temporal. Colores diferenciados para organico (verde) y pago (azul).

---

## EPIC: [F2] Stripe Monitor IA (Subfase 2.5)

**Asignacion principal:** Angel
**Dependencias:** F2 Setup Credenciales (2.1)
**Semana:** 6

---

### [F2-018] Schema + Pull Stripe + calculo MRR + churn

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Tabla stripe_metrics creada con campos: project_id, date, mrr, active_subs, cancelled_subs, churn_rate
  - [ ] MRR calculado correctamente como suma de suscripciones activas (amount/interval normalizado a mensual)
  - [ ] Churn rate calculado como canceladas / activas * 100 por periodo
  - [ ] Restricted key no puede hacer writes: verificado que POST/DELETE retorna 403
- **Notas tecnicas:** Usar Stripe API con auto-pagination para listar todas las suscripciones. Normalizar precios anuales a mensual (/12).

---

### [F2-019] Frontend: dashboard IA (MRR, subs, churn, evolucion 12 meses)

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Solo visible para Admin y Superadmin (Gestor no ve el modulo)
  - [ ] Cards principales: MRR actual, suscripciones activas, churn rate mensual
  - [ ] Grafica de evolucion MRR de los ultimos 12 meses (LineChart)
  - [ ] Grafica de churn rate mensual con tendencia
- **Notas tecnicas:** Calcular variacion MRR mes a mes (porcentaje de crecimiento). Colores: verde si crece, rojo si decrece.

---

## EPIC: [F2] Audiencias CSV + Reportes Claude (Subfase 2.6)

**Asignacion principal:** Diego
**Dependencias:** F2 Meta Ads (2.2), F2 Google Ads (2.3)
**Semana:** 6-7

---

### [F2-020] Endpoint export audiencias + hasheo SHA256 + formato CSV Meta

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Endpoint genera CSV con columnas: email_sha256, phone_sha256, fn (nombre), ln (apellido)
  - [ ] Hasheo SHA256 aplicado a email (lowercase, trim) y telefono (formato E.164)
  - [ ] CSV subido a Meta Business Manager como Custom Audience procesa sin errores
- **Notas tecnicas:** Formato Meta: https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences. Usar crypto.createHash('sha256').

---

### [F2-021] Frontend: wizard creacion audiencia

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Paso 1: seleccionar filtros (proyecto, status, canal, fecha, producto)
  - [ ] Paso 2: preview con cantidad de leads que cumplen los filtros
  - [ ] Paso 3: descarga CSV con nombre descriptivo (audiencia_proyecto_fecha.csv)
- **Notas tecnicas:** Wizard con 3 pasos (Stepper). Preview en tiempo real al cambiar filtros. Boton deshabilitado si audiencia tiene < 20 leads.

---

### [F2-022] Builder JSON + prompt system + integracion Claude API

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 8
- **Criterios de aceptacion:**
  - [ ] Builder genera JSON estructurado con datos del proyecto: leads, conversiones, campanas, ingresos
  - [ ] Prompt system instruye a Claude a generar reporte ejecutivo en markdown
  - [ ] Reporte generado con datos de prueba contiene cifras coherentes y accionables
  - [ ] Input total < 20.000 tokens (optimizar datos enviados)
- **Notas tecnicas:** Usar Claude Sonnet. Estructura del prompt: system (rol + formato) + user (datos JSON). Incluir seccion de recomendaciones accionables.

---

### [F2-023] Cron mensual + almacenamiento reportes

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Cron se ejecuta el dia 1 de cada mes a las 7:00 AM
  - [ ] Genera reporte del mes anterior por cada proyecto activo
  - [ ] Reporte almacenado en tabla reports (project_id, month, year, content_md, generated_at)
  - [ ] No regenera historico: si el reporte del mes ya existe, lo salta
- **Notas tecnicas:** Timeout generoso (2 min por reporte). Enviar email a Admin/SA con link al reporte tras generacion.

---

### [F2-024] Frontend: visualizador reportes markdown + boton Generar + historial

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Markdown renderizado correctamente con encabezados, listas, tablas y negritas
  - [ ] Historial navegable por proyecto y mes (selector)
  - [ ] Boton "Generar ahora" permite generar reporte manualmente (con loading state)
- **Notas tecnicas:** Usar react-markdown con remark-gfm para tablas. Boton de generar solo disponible para Admin/SA.

---

# FASE 3 - Funcionalidades Avanzadas

---

## EPIC: [F3] Custom Audiences Meta (Subfase 3.1)

**Asignacion principal:** Diego
**Dependencias:** F2 Audiencias CSV (2.6)
**Semana:** 8

---

### [F3-001] Upload Custom Audience a Meta API (paginado 10k) + polling estado

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 8
- **Criterios de aceptacion:**
  - [ ] 100 leads hasheados aparecen correctamente en Business Manager como Custom Audience
  - [ ] 15.000 leads se paginan en bloques de 10.000 y suben sin error
  - [ ] Polling del estado de procesamiento hasta completar (con timeout de 5 min)
  - [ ] Estado final (ready/error) se registra en DB
- **Notas tecnicas:** Usar Marketing API Custom Audiences endpoint. Paginar con sessions para uploads grandes. Manejar estado PENDING con polling cada 10 segundos.

---

### [F3-002] Frontend: boton "Subir a Meta" + estado tiempo real

- **Asignado a:** Diego
- **Tipo:** Frontend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Boton "Subir a Meta" visible en el wizard de audiencias tras generar CSV
  - [ ] Estado del upload visible en tiempo real: preparando, subiendo, procesando, completado/error
  - [ ] Historial de audiencias subidas con fecha, cantidad de leads y estado
- **Notas tecnicas:** Usar polling cada 5 segundos para actualizar estado. Deshabilitar boton mientras hay un upload en curso.

---

## EPIC: [F3] Meta Lead Ads Webhook (Subfase 3.2)

**Asignacion principal:** Diego
**Dependencias:** F1 Webhook (1.4), F2 Meta Ads (2.2)
**Semana:** 8-9

---

### [F3-003] Handshake verificacion Meta + endpoint POST leadgen

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] GET /webhooks/meta/leadgen responde correctamente al challenge de verificacion de Meta
  - [ ] POST /webhooks/meta/leadgen recibe lead de Meta y lo crea en CRM
  - [ ] Testing Tool de Meta envia lead de prueba y aparece en CRM en < 5 segundos
  - [ ] utm_source se setea automaticamente como 'meta' y canal como 'meta_lead_ads'
- **Notas tecnicas:** Verificar firma SHA256 del payload con app secret. Hacer GET a Graph API para obtener datos completos del lead (el webhook solo envia leadgen_id).

---

### [F3-004] Mapeo campos formulario Meta -> schema CRM + reusar round-robin

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Criterios de aceptacion:**
  - [ ] Campos del formulario Meta (full_name, email, phone_number) mapeados correctamente al schema de leads
  - [ ] Round-robin existente se reutiliza para asignar gestor (mismo mecanismo que webhook regular)
  - [ ] Campos custom del formulario Meta se almacenan en lead.metadata (JSON)
- **Notas tecnicas:** Crear tabla de mapeo de campos configurable por proyecto. Reutilizar funcion assignLeadToGestor().

---

## EPIC: [F3] Chat Claude AI (Subfase 3.3)

**Asignacion principal:** Angel
**Dependencias:** F2 Setup Credenciales (2.1)
**Semana:** 9

---

### [F3-005] Endpoint SSE streaming + context builder + rate limiting

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 8
- **Criterios de aceptacion:**
  - [ ] Endpoint GET /chat/stream responde con Server-Sent Events (text/event-stream)
  - [ ] Texto aparece token a token en el cliente (streaming real, no batch)
  - [ ] Pregunta sobre leads devuelve cifra correcta del proyecto activo del usuario
  - [ ] Rate limiting: maximo 20 mensajes por hora por usuario; mensaje 21 retorna 429
- **Notas tecnicas:** Context builder genera resumen del proyecto (leads, conversiones, campanas del ultimo mes). Usar Anthropic SDK con stream: true. Rate limit con sliding window en Redis o en memoria.

---

### [F3-006] Frontend: panel lateral chat + indicador escribiendo + preguntas rapidas

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] Panel lateral que no ocupa pantalla completa (400px de ancho, colapsable)
  - [ ] Streaming visible: texto aparece progresivamente con cursor parpadeante
  - [ ] 3 botones de pregunta rapida: "Resumen del mes", "Leads sin actividad", "Rendimiento campanas"
  - [ ] Historial de conversacion persistente durante la sesion
- **Notas tecnicas:** Usar EventSource API para SSE. Panel como Sheet de shadcn/ui con posicion derecha. Markdown en respuestas del chat.

---

## EPIC: [F3] Export PDF (Subfase 3.4)

**Asignacion principal:** Angel
**Dependencias:** F2 Reportes Claude (2.6)
**Semana:** 9-9.5

---

### [F3-007] Puppeteer: template HTML + render PDF + guardar R2

- **Asignado a:** Angel
- **Tipo:** Backend
- **Story points:** 5
- **Criterios de aceptacion:**
  - [ ] PDF generado correctamente desde template HTML con datos del reporte
  - [ ] Tiempo de generacion < 5 segundos
  - [ ] Tablas y graficas no se cortan entre paginas (page-break-inside: avoid)
  - [ ] Puppeteer consume < 300MB de RAM durante la generacion
  - [ ] PDF almacenado en R2 con URL pre-firmada para descarga
- **Notas tecnicas:** Usar puppeteer-core con chromium minimo. Template HTML con CSS print-friendly. Header/footer con logo y fecha.

---

### [F3-008] Frontend: boton Exportar PDF en vista de reporte

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 1
- **Criterios de aceptacion:**
  - [ ] Boton "Exportar PDF" visible en la vista de cualquier reporte generado
  - [ ] Loading state durante la generacion del PDF
  - [ ] Descarga automatica del PDF al completar (o abrir en nueva pestana)
- **Notas tecnicas:** Llamar al endpoint POST /reports/:id/export-pdf. Deshabilitar boton durante generacion.

---

# Resumen de Asignaciones

## Stories por Desarrollador y Fase

| Fase | Diego | Angel | Ambos | Total |
|---|---|---|---|---|
| Fase 1 (F1) | 30 | 27 | 5 | 62 (+3 QA compartidas) |
| Fase 2 (F2) | 15 | 12 | 0 | 27 |
| Fase 3 (F3) | 4 | 4 | 0 | 8 |
| **Total** | **~49** | **~43** | **~5** | **~97** |

## Story Points por Desarrollador

| Desarrollador | Fase 1 | Fase 2 | Fase 3 | Total |
|---|---|---|---|---|
| **Diego** | 108 | 57 | 19 | **184 pts** |
| **Angel** | 76 | 40 | 19 | **135 pts** |
| **Ambos (compartidas)** | 19 | 0 | 0 | **19 pts** |
| **Total** | **203** | **97** | **38** | **338 pts** |

## Story Points por Tipo

| Tipo | Cantidad Stories | Story Points |
|---|---|---|
| Backend | 40 | 155 |
| Frontend | 33 | 130 |
| Config | 12 | 30 |
| Fullstack | 1 | 5 |
| QA | 5 | 16 |
| **Total** | **~97** | **~338** |

## Calendario por Semanas

| Semana | Epics | Foco principal |
|---|---|---|
| 1 | F1 Setup (1.1) + Auth (1.2) + Productos (1.3) | Infraestructura, auth, CRUD basicos |
| 2 | F1 Webhook (1.4) + Ficha Lead (1.5) | Ingesta de leads, ficha y seguimiento |
| 2-3 | F1 Conversiones (1.6) | Flujo de conversion y pagos |
| 3 | F1 Dashboard + QA (1.7) | Dashboard, graficas y QA integral |
| 4 | F2 Credenciales (2.1) + Meta Ads (2.2) inicio | API keys, inicio Meta Ads |
| 4-5 | F2 Meta Ads (2.2) + Google Ads (2.3) | Metricas publicitarias |
| 5-6 | F2 GSC (2.4) + Stripe (2.5) | Trafico organico, MRR |
| 6-7 | F2 Audiencias + Reportes (2.6) | CSV, Claude AI reportes |
| 8 | F3 Custom Audiences (3.1) + Lead Ads (3.2) | Upload Meta, webhook Lead Ads |
| 9-9.5 | F3 Chat AI (3.3) + Export PDF (3.4) | Chat interactivo, exportacion |

---

> **Nota:** Los story points son estimaciones iniciales. Se recomienda hacer planning poker al inicio de cada sprint para ajustar. Las dependencias entre streams (Diego/Angel) deben coordinarse en daily standups.
