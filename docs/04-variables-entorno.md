# 04 - Variables de Entorno

## CRM MultiProyecto - Configuracion de Entorno

Este documento describe **todas las variables de entorno** necesarias para ejecutar el CRM MultiProyecto.
Las variables se definen en el archivo `backend/.env` (nunca se commitea) y se documentan en `backend/.env.example`.

---

## Tabla de contenidos

1. [Plantilla completa (.env.example)](#plantilla-completa)
2. [Descripcion detallada por categoria](#descripcion-detallada-por-categoria)
3. [Generacion de valores seguros](#generacion-de-valores-seguros)
4. [Variables por proyecto (almacenadas en BD)](#variables-por-proyecto)
5. [Diferencias entre desarrollo y produccion](#diferencias-entre-desarrollo-y-produccion)
6. [Notas de seguridad](#notas-de-seguridad)

---

## Plantilla completa

El siguiente bloque es el contenido exacto que debe ir en `backend/.env.example`.
Copiarlo a `backend/.env` y rellenar los valores marcados con comentario.

```env
# ============================================================
# CRM MultiProyecto - Variables de Entorno
# ============================================================
# Copiar este archivo a .env y completar los valores.
# NUNCA commitear el archivo .env real.
# ============================================================

# ------------------------------------------------------------
# SERVIDOR
# ------------------------------------------------------------
NODE_ENV=development
PORT=3001
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173

# ------------------------------------------------------------
# BASE DE DATOS - PostgreSQL
# ------------------------------------------------------------
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_multiproyecto
DB_USER=crm_user
DB_PASSWORD=                        # Generar password seguro (ver seccion "Generacion de valores")
DB_SSL=false
DB_POOL_MAX=10

# ------------------------------------------------------------
# JWT (JSON Web Tokens)
# ------------------------------------------------------------
JWT_SECRET=                         # Generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d
JWT_REFRESH_SECRET=                 # Generar igual que JWT_SECRET pero con valor DIFERENTE

# ------------------------------------------------------------
# BCRYPT
# ------------------------------------------------------------
BCRYPT_ROUNDS=12

# ------------------------------------------------------------
# CLOUDFLARE R2 (Storage para dossiers PDF)
# ------------------------------------------------------------
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=crm-dossiers
R2_ENDPOINT=                        # https://<account_id>.r2.cloudflarestorage.com

# ------------------------------------------------------------
# BREVO (Email transaccional)
# ------------------------------------------------------------
BREVO_API_KEY=
BREVO_SENDER_EMAIL=crm@dominio.com
BREVO_SENDER_NAME=CRM MultiProyecto
BREVO_TEMPLATE_WELCOME_ID=          # ID numerico del template en Brevo
BREVO_TEMPLATE_LEAD_NOTIFICATION_ID=
BREVO_TEMPLATE_REMINDER_ID=
BREVO_TEMPLATE_PAYMENT_ALERT_ID=

# ------------------------------------------------------------
# CORS
# ------------------------------------------------------------
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://psikoaprende.com,https://iseih.com,https://fonoaprende.com

# ------------------------------------------------------------
# ENCRYPTION (para tabla api_credentials)
# ------------------------------------------------------------
ENCRYPTION_KEY=                     # Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_IV_LENGTH=16

# ============================================================
# FASE 2 - Configurar antes de iniciar desarrollo Fase 2
# ============================================================

# ------------------------------------------------------------
# META MARKETING API
# ------------------------------------------------------------
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_USER_TOKEN=             # Token de larga duracion del System User
META_WEBHOOK_VERIFY_TOKEN=          # Token personalizado para verificacion webhook Lead Ads (Fase 3)

# ------------------------------------------------------------
# GOOGLE OAUTH2 (compartido entre Google Ads y GSC)
# ------------------------------------------------------------
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_MCC_CUSTOMER_ID=             # ID de cuenta MCC sin guiones

# ------------------------------------------------------------
# STRIPE (proyectos IA - solo lectura)
# ------------------------------------------------------------
STRIPE_RESTRICTED_KEY=              # rk_live_... con permisos solo de lectura

# ------------------------------------------------------------
# CLAUDE AI (Anthropic)
# ------------------------------------------------------------
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-5
CLAUDE_MAX_TOKENS_REPORT=4096
CLAUDE_MAX_TOKENS_CHAT=2048
CLAUDE_RATE_LIMIT_PER_HOUR=20

# ------------------------------------------------------------
# CRON JOBS
# ------------------------------------------------------------
CRON_TIMEZONE=Europe/Madrid
CRON_DAILY_REMINDERS=0 8 * * *         # 8:00 AM - Recordatorios de seguimiento
CRON_DAILY_META_SYNC=0 6 * * *         # 6:00 AM - Sincronizar datos de Meta Ads
CRON_DAILY_GOOGLE_SYNC=0 6 30 * *      # 6:30 AM - Sincronizar datos de Google Ads
CRON_DAILY_GSC_SYNC=0 7 * * *          # 7:00 AM - Sincronizar datos de Google Search Console
CRON_DAILY_STRIPE_SYNC=0 7 30 * *      # 7:30 AM - Sincronizar datos de Stripe
CRON_DAILY_PAYMENT_ALERTS=0 9 * * *    # 9:00 AM - Alertas de pagos pendientes/vencidos
CRON_MONTHLY_REPORT=0 8 1 * *          # Dia 1 de cada mes, 8:00 AM - Reporte mensual
```

---

## Descripcion detallada por categoria

### Servidor

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `NODE_ENV` | `development` | Entorno de ejecucion. Valores posibles: `development` o `production`. Controla el nivel de logging, mensajes de error detallados, y optimizaciones de rendimiento. |
| `PORT` | `3001` | Puerto en el que escucha el servidor Express. |
| `BASE_URL` | `http://localhost:3001` | URL base del backend. Se usa para construir URLs absolutas (callbacks OAuth, enlaces en emails, etc.). En produccion: `https://IP_DEL_SERVIDOR`. |
| `FRONTEND_URL` | `http://localhost:5173` | URL del frontend (Vite dev server en desarrollo). Se usa para redirecciones post-login y enlaces en emails. En produccion: `https://IP_DEL_SERVIDOR/crm`. |

### Base de datos - PostgreSQL

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `DB_HOST` | `localhost` | Host del servidor PostgreSQL. |
| `DB_PORT` | `5432` | Puerto de PostgreSQL. |
| `DB_NAME` | `crm_multiproyecto` | Nombre de la base de datos. |
| `DB_USER` | `crm_user` | Usuario de la base de datos. Debe tener permisos sobre `DB_NAME`. |
| `DB_PASSWORD` | *(vacio)* | Contrasena del usuario de BD. **Obligatorio**. Generar un password seguro de al menos 20 caracteres. |
| `DB_SSL` | `false` | Activar conexion SSL a la BD. Poner `true` en produccion si el servidor PostgreSQL tiene SSL configurado. |
| `DB_POOL_MAX` | `10` | Numero maximo de conexiones simultaneas en el pool de conexiones. Ajustar segun la carga esperada. |

### JWT (JSON Web Tokens)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `JWT_SECRET` | *(vacio)* | Clave secreta para firmar los access tokens. **Obligatorio**. Debe ser un string largo y aleatorio (128 caracteres hex recomendados). |
| `JWT_ACCESS_EXPIRATION` | `15m` | Tiempo de vida del access token. Formato: `15m` = 15 minutos, `1h` = 1 hora. Se recomienda mantenerlo corto por seguridad. |
| `JWT_REFRESH_EXPIRATION` | `30d` | Tiempo de vida del refresh token. Formato: `30d` = 30 dias. Permite al usuario mantener la sesion sin re-autenticarse. |
| `JWT_REFRESH_SECRET` | *(vacio)* | Clave secreta para firmar los refresh tokens. **Obligatorio**. Debe ser **diferente** al `JWT_SECRET` para que comprometer uno no comprometa el otro. |

### Bcrypt

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `BCRYPT_ROUNDS` | `12` | Numero de rondas de hashing para contrasenas. Valores mas altos son mas seguros pero mas lentos. 12 es un buen equilibrio. No bajar de 10 en produccion. |

### Cloudflare R2 (Storage para dossiers PDF)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `R2_ACCOUNT_ID` | *(vacio)* | ID de la cuenta de Cloudflare. Se encuentra en el dashboard de Cloudflare > R2. |
| `R2_ACCESS_KEY_ID` | *(vacio)* | Access Key del token de API de R2. Generar en Cloudflare Dashboard > R2 > Manage R2 API Tokens. |
| `R2_SECRET_ACCESS_KEY` | *(vacio)* | Secret Key correspondiente al Access Key. Solo se muestra una vez al crear el token. |
| `R2_BUCKET_NAME` | `crm-dossiers` | Nombre del bucket en R2. Debe existir previamente. |
| `R2_ENDPOINT` | *(vacio)* | Endpoint S3-compatible de R2. Formato: `https://<account_id>.r2.cloudflarestorage.com`. |

### Brevo (Email transaccional)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `BREVO_API_KEY` | *(vacio)* | API key de Brevo. Obtener en Brevo Dashboard > SMTP & API > API Keys. |
| `BREVO_SENDER_EMAIL` | `crm@dominio.com` | Email del remitente. Debe estar verificado en Brevo como sender autorizado. |
| `BREVO_SENDER_NAME` | `CRM MultiProyecto` | Nombre visible del remitente en los emails. |
| `BREVO_TEMPLATE_WELCOME_ID` | *(vacio)* | ID numerico del template de bienvenida en Brevo. Crear el template en Brevo y copiar su ID. |
| `BREVO_TEMPLATE_LEAD_NOTIFICATION_ID` | *(vacio)* | ID del template para notificacion de nuevo lead. |
| `BREVO_TEMPLATE_REMINDER_ID` | *(vacio)* | ID del template para recordatorios de seguimiento. |
| `BREVO_TEMPLATE_PAYMENT_ALERT_ID` | *(vacio)* | ID del template para alertas de pago. |

### CORS

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Lista de origenes permitidos separados por coma. Incluir todos los dominios de los proyectos que acceden al CRM. En desarrollo incluir `http://localhost:5173`. |

### Encryption (para tabla api_credentials)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `ENCRYPTION_KEY` | *(vacio)* | Clave AES-256 para cifrar credenciales de APIs de terceros almacenadas en la tabla `api_credentials`. **Obligatorio**. 64 caracteres hex (32 bytes). |
| `ENCRYPTION_IV_LENGTH` | `16` | Longitud del vector de inicializacion (IV) para AES. No cambiar a menos que se sepa lo que se esta haciendo. |

### Meta Marketing API (Fase 2)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `META_APP_ID` | *(vacio)* | ID de la app de Meta for Developers. Crear en developers.facebook.com. |
| `META_APP_SECRET` | *(vacio)* | Secret de la app de Meta. Se encuentra en App Settings > Basic. |
| `META_SYSTEM_USER_TOKEN` | *(vacio)* | Token de acceso de larga duracion del System User del Business Manager. Necesario para acceder a la Marketing API sin re-autenticacion. |
| `META_WEBHOOK_VERIFY_TOKEN` | *(vacio)* | Token personalizado que Meta envia al configurar webhooks de Lead Ads (Fase 3). Puede ser cualquier string aleatorio que tu definas. |

### Google OAuth2 (Fase 2)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `GOOGLE_CLIENT_ID` | *(vacio)* | Client ID de Google Cloud Console. Proyecto con APIs de Google Ads y Search Console habilitadas. |
| `GOOGLE_CLIENT_SECRET` | *(vacio)* | Client Secret correspondiente. |
| `GOOGLE_REFRESH_TOKEN` | *(vacio)* | Refresh token obtenido mediante flujo OAuth2. Permite obtener access tokens sin interaccion del usuario. |
| `GOOGLE_MCC_CUSTOMER_ID` | *(vacio)* | ID de la cuenta MCC (My Client Center) de Google Ads, **sin guiones**. Ejemplo: `1234567890` en vez de `123-456-7890`. |

### Stripe (Fase 2)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `STRIPE_RESTRICTED_KEY` | *(vacio)* | Restricted API key de Stripe con permisos de **solo lectura**. Formato: `rk_live_...`. Crear en Stripe Dashboard > Developers > API Keys > Restricted Keys. Permisos minimos: lectura de charges, subscriptions, invoices y customers. |

### Claude AI - Anthropic (Fase 2)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `CLAUDE_API_KEY` | *(vacio)* | API key de Anthropic. Obtener en console.anthropic.com. |
| `CLAUDE_MODEL` | `claude-sonnet-4-5` | Modelo a utilizar. `claude-sonnet-4-5` ofrece buen balance entre calidad y coste. |
| `CLAUDE_MAX_TOKENS_REPORT` | `4096` | Maximo de tokens en la respuesta al generar reportes mensuales con IA. |
| `CLAUDE_MAX_TOKENS_CHAT` | `2048` | Maximo de tokens en respuestas del chat/asistente de consultas. |
| `CLAUDE_RATE_LIMIT_PER_HOUR` | `20` | Limite de llamadas a la API de Claude por hora (aplicado a nivel de aplicacion). Previene costes inesperados. |

### Cron Jobs (Fase 2)

| Variable | Valor por defecto | Descripcion |
|---|---|---|
| `CRON_TIMEZONE` | `Europe/Madrid` | Zona horaria para los cron jobs. Todos los horarios se interpretan en esta zona. |
| `CRON_DAILY_REMINDERS` | `0 8 * * *` | 8:00 AM - Enviar recordatorios de seguimiento pendientes para hoy. |
| `CRON_DAILY_META_SYNC` | `0 6 * * *` | 6:00 AM - Sincronizar metricas de campanas de Meta Ads del dia anterior. |
| `CRON_DAILY_GOOGLE_SYNC` | `0 6 30 * *` | 6:30 AM - Sincronizar metricas de campanas de Google Ads del dia anterior. |
| `CRON_DAILY_GSC_SYNC` | `0 7 * * *` | 7:00 AM - Sincronizar datos de Google Search Console (trafico organico). |
| `CRON_DAILY_STRIPE_SYNC` | `0 7 30 * *` | 7:30 AM - Sincronizar datos de pagos y suscripciones desde Stripe. |
| `CRON_DAILY_PAYMENT_ALERTS` | `0 9 * * *` | 9:00 AM - Revisar pagos pendientes o vencidos y enviar alertas por email. |
| `CRON_MONTHLY_REPORT` | `0 8 1 * *` | Dia 1 de cada mes a las 8:00 AM - Generar reporte mensual consolidado con IA. |

---

## Generacion de valores seguros

### JWT_SECRET y JWT_REFRESH_SECRET

Generar dos valores **diferentes** ejecutando el siguiente comando dos veces:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Esto produce un string de 128 caracteres hexadecimales (64 bytes de entropia). Ejemplo de salida:

```
a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8
```

### ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Produce 64 caracteres hex (32 bytes), necesarios para AES-256.

### DB_PASSWORD

Opcion 1 - Con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(20).toString('base64url'))"
```

Opcion 2 - Con OpenSSL:

```bash
openssl rand -base64 24
```

### META_WEBHOOK_VERIFY_TOKEN

Puede ser cualquier string aleatorio. Recomendacion:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Variables por proyecto (almacenadas en BD)

Las siguientes credenciales son **especificas por proyecto** y NO se almacenan en el archivo `.env`. Se guardan cifradas en la tabla `api_credentials` de la base de datos, usando la `ENCRYPTION_KEY` del `.env` para el cifrado AES-256.

| Dato | Tabla BD | Descripcion |
|---|---|---|
| Meta `ad_account_id` | `api_credentials` | ID de la cuenta publicitaria de Meta para cada proyecto (ej: `act_123456789`). |
| Google Ads `customer_id` | `api_credentials` | ID de la cuenta de Google Ads del proyecto dentro de la MCC (sin guiones). |
| Google Search Console `property_url` | `api_credentials` | URL de la propiedad en GSC (ej: `https://psikoaprende.com`). |
| Stripe cuenta por proyecto IA | `api_credentials` | Identificador de la cuenta Stripe conectada a cada proyecto IA. |
| Webhook API key por proyecto | `api_credentials` | API key unica que se genera por proyecto para autenticar webhooks entrantes. |

**Por que en BD y no en `.env`:**

- El CRM es **multiproyecto**. Cada proyecto tiene sus propias cuentas publicitarias, propiedades de analytics y cuentas de pago.
- Las credenciales globales (app secrets, tokens de acceso principal) van en `.env` porque son compartidas.
- Las credenciales por proyecto van en BD porque son dinamicas: se pueden agregar, editar y eliminar desde la interfaz de administracion sin reiniciar el servidor.

---

## Diferencias entre desarrollo y produccion

| Variable | Desarrollo | Produccion |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `BASE_URL` | `http://localhost:3001` | `https://IP_DEL_SERVIDOR` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://IP_DEL_SERVIDOR/crm` |
| `DB_SSL` | `false` | `true` (si el servidor PostgreSQL tiene SSL) |
| `DB_POOL_MAX` | `10` | `20-50` (segun carga esperada) |
| `BCRYPT_ROUNDS` | `12` | `12` (se puede subir a 14 si el servidor tiene buena CPU) |
| `CORS_ALLOWED_ORIGINS` | Incluye `http://localhost:5173` | Solo dominios de produccion |
| `CLAUDE_RATE_LIMIT_PER_HOUR` | `20` | Ajustar segun presupuesto |

### Notas adicionales para produccion

- `NODE_ENV=production` activa optimizaciones en Express (cache de vistas, menos logging verbose).
- Los secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, etc.) deben ser **diferentes** entre desarrollo y produccion.
- En produccion, considerar usar un gestor de secretos (como HashiCorp Vault o las variables de entorno del proveedor de hosting) en vez de un archivo `.env`.

---

## Notas de seguridad

### Permisos del archivo .env

```bash
chmod 600 backend/.env
```

Solo el propietario del archivo puede leerlo y escribirlo. Ningun otro usuario del sistema tendra acceso.

### Nunca commitear el .env

Verificar que `backend/.env` esta en el `.gitignore`:

```gitignore
# En la raiz del proyecto o en backend/.gitignore
.env
.env.local
.env.*.local
```

Para verificar que no se ha commiteado accidentalmente:

```bash
git ls-files --cached backend/.env
```

Si devuelve algo, eliminarlo del tracking sin borrar el archivo:

```bash
git rm --cached backend/.env
git commit -m "Eliminar .env del tracking de git"
```

### Rotacion de secrets

- **JWT_SECRET / JWT_REFRESH_SECRET**: Rotar periodicamente. Al cambiar el JWT_SECRET, todos los access tokens activos se invalidan. Al cambiar el JWT_REFRESH_SECRET, todos los refresh tokens se invalidan (los usuarios deberan re-autenticarse).
- **ENCRYPTION_KEY**: **No rotar sin migracion**. Si se cambia, todos los datos cifrados en `api_credentials` se vuelven ilegibles. Implementar un proceso de re-cifrado antes de rotar.
- **DB_PASSWORD**: Rotar periodicamente. Actualizar en `.env` y en PostgreSQL simultaneamente.

### Variables sensibles (nunca exponer en logs o respuestas API)

- `DB_PASSWORD`
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `R2_SECRET_ACCESS_KEY`
- `BREVO_API_KEY`
- `META_APP_SECRET` / `META_SYSTEM_USER_TOKEN`
- `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN`
- `STRIPE_RESTRICTED_KEY`
- `CLAUDE_API_KEY`

Asegurarse de que el middleware de logging del backend **no registre** estas variables. Usar una funcion de sanitizacion que reemplace valores sensibles con `[REDACTED]` antes de escribir logs.
