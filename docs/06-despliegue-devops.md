# Despliegue y DevOps - CRM MultiProyecto

Guia completa para desplegar, mantener y operar el CRM MultiProyecto en un VPS Hostinger (KVM).

---

## 1. Arquitectura del servidor

### Especificaciones

| Componente       | Detalle                                      |
| ---------------- | -------------------------------------------- |
| Proveedor        | Hostinger VPS (KVM)                          |
| SO               | Ubuntu 22.04 LTS                             |
| Frontend URL     | `https://IP_DEL_SERVIDOR/crm`                |
| Backend URL      | `https://IP_DEL_SERVIDOR/crm/api`            |
| Reverse Proxy    | Nginx (puertos 80/443)                       |
| Backend          | Node.js + Express en puerto 3001 (via PM2)   |
| Base de datos    | PostgreSQL en puerto 5432 (solo localhost)    |
| SSL              | Certbot (Let's Encrypt)                      |

### Diagrama de arquitectura

```
                         INTERNET
                            |
                            v
                   +------------------+
                   |   Nginx :443     |
                   |  (reverse proxy) |
                   +--------+---------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
     /crm (static files)         /crm/api (proxy)
     Archivos React SPA           |
     /var/www/crm/                |
       frontend/dist              v
                           +-------------+
                           |  Node.js    |
                           |  Express    |
                           |  :3001      |
                           |  (PM2)      |
                           +------+------+
                                  |
                                  v
                           +-------------+
                           | PostgreSQL  |
                           |   :5432     |
                           | (localhost) |
                           +-------------+
```

### Flujo de una peticion

1. El navegador hace una peticion a `https://IP_DEL_SERVIDOR/crm` o `https://IP_DEL_SERVIDOR/crm/api`
2. Nginx recibe la peticion en el puerto 443 (HTTPS)
3. Si la ruta empieza con `/crm/api`, Nginx reescribe la URL y hace proxy a `http://127.0.0.1:3001`
4. Si la ruta empieza con `/crm`, Nginx sirve los archivos estaticos de la SPA React desde `/var/www/crm/frontend/dist`
5. El backend Node.js se conecta a PostgreSQL en `localhost:5432`
6. PostgreSQL nunca esta expuesto a internet

---

## 2. Configuracion Nginx completa

Archivo: `/etc/nginx/sites-available/crm`

```nginx
server {
    listen 80;
    server_name IP_DEL_SERVIDOR;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name IP_DEL_SERVIDOR;

    ssl_certificate /etc/letsencrypt/live/IP_DEL_SERVIDOR/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/IP_DEL_SERVIDOR/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # React SPA
    location /crm {
        alias /var/www/crm/frontend/dist;
        try_files $uri $uri/ /crm/index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /crm/api {
        rewrite ^/crm/api(/.*)$ /api$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support (for Claude chat streaming)
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # Webhook rate limiting
    location /crm/api/webhooks {
        limit_req zone=webhooks burst=50 nodelay;
        rewrite ^/crm/api(/.*)$ /api$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Rate limiting zone (agregar dentro del bloque http en /etc/nginx/nginx.conf)
# limit_req_zone $binary_remote_addr zone=webhooks:10m rate=10r/s;
```

### Activar el sitio

```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. PM2 - ecosystem.config.js

Archivo: `/var/www/crm/ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'crm-api',
    script: './src/app.js',
    cwd: '/var/www/crm/backend',
    instances: 1,
    exec_mode: 'fork',
    node_args: '--experimental-modules',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/crm-error.log',
    out_file: '/var/log/pm2/crm-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '300M',
    restart_delay: 4000,
    max_restarts: 10,
    watch: false
  }]
}
```

### Comandos PM2 frecuentes

```bash
# Iniciar la aplicacion
pm2 start ecosystem.config.js --env production

# Reiniciar
pm2 restart crm-api

# Detener
pm2 stop crm-api

# Ver logs en tiempo real
pm2 logs crm-api --lines 100

# Estado de los procesos
pm2 status

# Monitoreo interactivo
pm2 monit

# Guardar procesos para auto-inicio
pm2 save
pm2 startup
```

---

## 4. Script de backup

Archivo: `/var/www/crm/scripts/backup.sh`

```bash
#!/bin/bash
# =============================================================================
# Backup automatizado de PostgreSQL para CRM MultiProyecto
# Destino: Cloudflare R2 (compatible con S3)
# Cron: 0 3 * * * /var/www/crm/scripts/backup.sh >> /var/log/crm-backup.log 2>&1
# =============================================================================

set -euo pipefail

# --- Configuracion ---
DB_NAME="crm_multiproyecto"
DB_USER="crm_user"
BACKUP_DIR="/tmp/crm-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="crm_backup_${TIMESTAMP}.sql.gz"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Cloudflare R2 (compatible con AWS S3)
R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
R2_BUCKET="crm-backups"
R2_PROFILE="r2"
RETENTION_DAYS=30

# --- Funciones ---
log_info() {
    echo "${LOG_PREFIX} [INFO] $1"
}

log_error() {
    echo "${LOG_PREFIX} [ERROR] $1" >&2
}

cleanup() {
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
        log_info "Archivo local eliminado: ${BACKUP_FILE}"
    fi
}

# --- Ejecucion ---
log_info "=== Inicio de backup ==="

# Crear directorio temporal si no existe
mkdir -p "${BACKUP_DIR}"

# Paso 1: Crear dump de PostgreSQL comprimido con gzip
log_info "Generando dump de la base de datos ${DB_NAME}..."
if pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges --clean --if-exists | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log_info "Dump completado: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    log_error "Fallo al crear el dump de PostgreSQL"
    exit 1
fi

# Paso 2: Subir a Cloudflare R2
log_info "Subiendo backup a Cloudflare R2 (bucket: ${R2_BUCKET})..."
if aws s3 cp \
    "${BACKUP_DIR}/${BACKUP_FILE}" \
    "s3://${R2_BUCKET}/${BACKUP_FILE}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --profile "${R2_PROFILE}" \
    --quiet; then
    log_info "Backup subido exitosamente a R2: s3://${R2_BUCKET}/${BACKUP_FILE}"
else
    log_error "Fallo al subir el backup a Cloudflare R2"
    cleanup
    exit 1
fi

# Paso 3: Eliminar copia local
cleanup

# Paso 4: Eliminar backups antiguos en R2 (mayores a RETENTION_DAYS dias)
log_info "Eliminando backups con mas de ${RETENTION_DAYS} dias en R2..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y-%m-%d")

aws s3 ls "s3://${R2_BUCKET}/" \
    --endpoint-url "${R2_ENDPOINT}" \
    --profile "${R2_PROFILE}" \
    | while read -r line; do
    FILE_DATE=$(echo "${line}" | awk '{print $1}')
    FILE_NAME=$(echo "${line}" | awk '{print $4}')

    if [ -z "${FILE_NAME}" ]; then
        continue
    fi

    if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
        log_info "Eliminando backup antiguo: ${FILE_NAME} (fecha: ${FILE_DATE})"
        aws s3 rm "s3://${R2_BUCKET}/${FILE_NAME}" \
            --endpoint-url "${R2_ENDPOINT}" \
            --profile "${R2_PROFILE}" \
            --quiet
    fi
done

log_info "=== Backup completado exitosamente ==="
```

### Configurar cron

```bash
# Editar crontab del usuario root
sudo crontab -e

# Agregar la siguiente linea (backup diario a las 3:00 AM)
0 3 * * * /var/www/crm/scripts/backup.sh >> /var/log/crm-backup.log 2>&1
```

### Configurar credenciales de Cloudflare R2

```bash
# Configurar perfil de AWS CLI para R2
aws configure --profile r2

# Ingresar:
# AWS Access Key ID: (Access Key de R2)
# AWS Secret Access Key: (Secret Key de R2)
# Default region name: auto
# Default output format: json
```

### Restaurar un backup

```bash
# Descargar desde R2
aws s3 cp s3://crm-backups/crm_backup_20260401_030000.sql.gz /tmp/ \
    --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com \
    --profile r2

# Descomprimir y restaurar
gunzip -c /tmp/crm_backup_20260401_030000.sql.gz | psql -U crm_user -d crm_multiproyecto
```

---

## 5. Script de deploy

Archivo: `/var/www/crm/scripts/deploy.sh`

```bash
#!/bin/bash
# =============================================================================
# Script de deploy para CRM MultiProyecto
# Uso: sudo /var/www/crm/scripts/deploy.sh
# =============================================================================

set -euo pipefail

PROJECT_DIR="/var/www/crm"
BACKEND_DIR="${PROJECT_DIR}/backend"
FRONTEND_DIR="${PROJECT_DIR}/frontend"
MIGRATIONS_DIR="${BACKEND_DIR}/src/database/migrations"
HEALTH_URL="http://localhost:3001/api/health"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}${LOG_PREFIX} [INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}${LOG_PREFIX} [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}${LOG_PREFIX} [ERROR]${NC} $1" >&2
}

# --- Paso 1: Actualizar codigo fuente ---
log_info "=== Iniciando deploy ==="
log_info "Paso 1/7: Actualizando codigo fuente..."
cd "${PROJECT_DIR}"
git fetch origin main
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "${LOCAL_HASH}" = "${REMOTE_HASH}" ]; then
    log_warn "No hay cambios nuevos en origin/main. Continuando de todas formas..."
fi

git pull origin main
NEW_HASH=$(git rev-parse --short HEAD)
log_info "Codigo actualizado a commit: ${NEW_HASH}"

# --- Paso 2: Instalar dependencias del backend ---
log_info "Paso 2/7: Instalando dependencias del backend..."
cd "${BACKEND_DIR}"
npm ci --production
log_info "Dependencias del backend instaladas"

# --- Paso 3: Ejecutar migraciones pendientes ---
log_info "Paso 3/7: Verificando migraciones pendientes..."
cd "${BACKEND_DIR}"

MIGRATIONS_APPLIED_DIR="${PROJECT_DIR}/.migrations_applied"
mkdir -p "${MIGRATIONS_APPLIED_DIR}"

MIGRATION_COUNT=0
if [ -d "${MIGRATIONS_DIR}" ]; then
    for MIGRATION_FILE in "${MIGRATIONS_DIR}"/*.sql; do
        if [ ! -f "${MIGRATION_FILE}" ]; then
            continue
        fi

        MIGRATION_NAME=$(basename "${MIGRATION_FILE}")
        MARKER_FILE="${MIGRATIONS_APPLIED_DIR}/${MIGRATION_NAME}.done"

        if [ ! -f "${MARKER_FILE}" ]; then
            log_info "Ejecutando migracion: ${MIGRATION_NAME}"
            if psql -U crm_user -d crm_multiproyecto -f "${MIGRATION_FILE}"; then
                touch "${MARKER_FILE}"
                MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
                log_info "Migracion aplicada: ${MIGRATION_NAME}"
            else
                log_error "Fallo la migracion: ${MIGRATION_NAME}"
                log_error "Deploy abortado. Corrige la migracion y vuelve a ejecutar."
                exit 1
            fi
        fi
    done
fi

if [ "${MIGRATION_COUNT}" -eq 0 ]; then
    log_info "No hay migraciones pendientes"
else
    log_info "${MIGRATION_COUNT} migracion(es) aplicada(s)"
fi

# --- Paso 4: Reiniciar backend con PM2 ---
log_info "Paso 4/7: Reiniciando backend con PM2..."
pm2 restart crm-api
log_info "Backend reiniciado"

# --- Paso 5: Instalar dependencias del frontend ---
log_info "Paso 5/7: Instalando dependencias del frontend..."
cd "${FRONTEND_DIR}"
npm ci
log_info "Dependencias del frontend instaladas"

# --- Paso 6: Build del frontend ---
log_info "Paso 6/7: Compilando frontend..."
npm run build
log_info "Frontend compilado"

# --- Paso 7: Verificar health check ---
log_info "Paso 7/7: Verificando health check..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")

if [ "${HTTP_STATUS}" = "200" ]; then
    log_info "========================================="
    log_info "  DEPLOY EXITOSO"
    log_info "  Commit: ${NEW_HASH}"
    log_info "  Health check: OK (HTTP ${HTTP_STATUS})"
    log_info "  Migraciones aplicadas: ${MIGRATION_COUNT}"
    log_info "========================================="
else
    log_error "========================================="
    log_error "  DEPLOY CON PROBLEMAS"
    log_error "  Health check fallo: HTTP ${HTTP_STATUS}"
    log_error "  Revisar logs: pm2 logs crm-api --lines 50"
    log_error "========================================="
    exit 1
fi
```

### Dar permisos de ejecucion

```bash
chmod +x /var/www/crm/scripts/deploy.sh
chmod +x /var/www/crm/scripts/backup.sh
```

---

## 6. Setup inicial del servidor (paso a paso)

### Paso 1: Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### Paso 2: Instalar Node.js LTS via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
node --version
npm --version
```

### Paso 3: Instalar PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Paso 4: Crear usuario y base de datos

```bash
sudo -u postgres psql <<SQL
CREATE USER crm_user WITH PASSWORD 'CONTRASENA_SEGURA_AQUI';
CREATE DATABASE crm_multiproyecto OWNER crm_user;
GRANT ALL PRIVILEGES ON DATABASE crm_multiproyecto TO crm_user;
\q
SQL
```

### Paso 5: Instalar Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Paso 6: Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Paso 7: Instalar PM2

```bash
npm install -g pm2
```

### Paso 8: Instalar AWS CLI (para backups a R2)

```bash
sudo apt install awscli -y
```

### Paso 9: Clonar el repositorio

```bash
sudo mkdir -p /var/www/crm
sudo chown $USER:$USER /var/www/crm
git clone https://github.com/USUARIO/crm-multiproyecto.git /var/www/crm
```

### Paso 10: Configurar variables de entorno

```bash
cd /var/www/crm/backend
cp .env.example .env
nano .env
```

Contenido del `.env` de produccion:

```env
NODE_ENV=production
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_multiproyecto
DB_USER=crm_user
DB_PASSWORD=CONTRASENA_SEGURA_AQUI

JWT_SECRET=GENERAR_CON_openssl_rand_base64_64
JWT_EXPIRES_IN=24h

CLAUDE_API_KEY=sk-ant-CLAVE_DE_CLAUDE

CORS_ORIGIN=https://IP_DEL_SERVIDOR
```

```bash
chmod 600 /var/www/crm/backend/.env
```

### Paso 11: Ejecutar migraciones

```bash
cd /var/www/crm/backend
for f in src/database/migrations/*.sql; do
    echo "Ejecutando: $f"
    psql -U crm_user -d crm_multiproyecto -f "$f"
done
```

### Paso 12: Ejecutar seeds

```bash
cd /var/www/crm/backend
for f in src/database/seeds/*.sql; do
    echo "Ejecutando seed: $f"
    psql -U crm_user -d crm_multiproyecto -f "$f"
done
```

### Paso 13: Instalar dependencias y compilar frontend

```bash
cd /var/www/crm/frontend
npm ci
npm run build
```

### Paso 14: Instalar dependencias del backend

```bash
cd /var/www/crm/backend
npm ci --production
```

### Paso 15: Configurar Nginx

```bash
sudo cp /var/www/crm/scripts/nginx-crm.conf /etc/nginx/sites-available/crm
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
sudo rm -f /etc/nginx/sites-enabled/default

# Agregar rate limiting al bloque http de nginx.conf
sudo nano /etc/nginx/nginx.conf
# Agregar dentro del bloque http { ... }:
#   limit_req_zone $binary_remote_addr zone=webhooks:10m rate=10r/s;

sudo nginx -t
sudo systemctl reload nginx
```

### Paso 16: Obtener certificado SSL

```bash
sudo certbot --nginx -d IP_DEL_SERVIDOR
```

> **Nota:** Si se usa una IP en lugar de un dominio, Certbot con Let's Encrypt no podra generar un certificado. En ese caso usar un certificado autofirmado o configurar un dominio que apunte a la IP del servidor.

### Paso 17: Iniciar la aplicacion con PM2

```bash
cd /var/www/crm
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Paso 18: Crear directorio de logs de PM2

```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2
```

### Paso 19: Configurar backup automatico

```bash
chmod +x /var/www/crm/scripts/backup.sh
sudo crontab -e
# Agregar: 0 3 * * * /var/www/crm/scripts/backup.sh >> /var/log/crm-backup.log 2>&1
```

### Paso 20: Configurar firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirige a HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### Paso 21: Verificar que todo funciona

```bash
# Backend health check
curl -s http://localhost:3001/api/health

# Nginx status
sudo systemctl status nginx

# PM2 status
pm2 status

# PostgreSQL status
sudo systemctl status postgresql

# Firewall status
sudo ufw status verbose
```

---

## 7. Git branching strategy

### Ramas principales

| Rama                  | Proposito                                          | Protegida |
| --------------------- | -------------------------------------------------- | --------- |
| `main`                | Produccion. Solo se actualiza via PR desde `dev`    | Si        |
| `dev`                 | Rama de integracion donde ambos devs hacen merge    | No        |

### Ramas de trabajo

| Tipo                   | Formato                   | Origen  | Destino              |
| ---------------------- | ------------------------- | ------- | -------------------- |
| Feature                | `feature/nombre-corto`    | `dev`   | `dev` (via PR)       |
| Hotfix                 | `hotfix/nombre`           | `main`  | `main` Y `dev`       |

### Flujo de trabajo

```
feature/nueva-funcionalidad
         |
         | (PR + code review)
         v
        dev  ←──── feature/otra-funcionalidad
         |
         | (PR al final de subfase)
         v
       main  ←──── hotfix/fix-critico ───→ dev
```

### Flujo detallado

1. **Crear rama feature desde dev:**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/nombre-corto
   ```

2. **Trabajar en la feature con commits frecuentes:**
   ```bash
   git add .
   git commit -m "feat: descripcion del cambio"
   git push origin feature/nombre-corto
   ```

3. **Crear PR hacia dev:**
   ```bash
   gh pr create --base dev --title "feat: descripcion" --body "Descripcion detallada"
   ```

4. **Review y merge a dev:**
   - El otro dev revisa el PR
   - Se aprueba y se hace merge (squash o merge commit)

5. **Al final de la subfase, PR de dev a main:**
   ```bash
   gh pr create --base main --head dev --title "Release: subfase X.Y"
   ```

6. **Hotfix (fixes criticos en produccion):**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/nombre-del-fix
   # Hacer el fix
   git push origin hotfix/nombre-del-fix
   # Crear PR a main
   gh pr create --base main --title "hotfix: descripcion"
   # Despues de merge a main, tambien mergear a dev
   git checkout dev
   git merge main
   git push origin dev
   ```

### Convenciones de commits

```
feat: nueva funcionalidad
fix: correccion de bug
refactor: reestructuracion sin cambio funcional
docs: documentacion
test: tests
chore: tareas de mantenimiento
```

---

## 8. Monitorizacion

### Logs de la aplicacion (PM2)

```bash
# Ver ultimas 100 lineas de logs
pm2 logs crm-api --lines 100

# Solo errores
pm2 logs crm-api --err --lines 50

# Solo salida estandar
pm2 logs crm-api --out --lines 50

# Limpiar logs
pm2 flush crm-api
```

### Estado de procesos PM2

```bash
# Estado general
pm2 status

# Detalles de un proceso
pm2 describe crm-api

# Monitoreo interactivo (CPU, memoria, logs)
pm2 monit
```

### Logs de Nginx

```bash
# Access log en tiempo real
tail -f /var/log/nginx/access.log

# Error log en tiempo real
tail -f /var/log/nginx/error.log

# Buscar errores 5xx
grep " 5[0-9][0-9] " /var/log/nginx/access.log | tail -20
```

### PostgreSQL

```bash
# Conexiones activas
sudo -u postgres psql -c "SELECT pid, usename, application_name, client_addr, state, query_start, query FROM pg_stat_activity WHERE datname = 'crm_multiproyecto';"

# Tamano de la base de datos
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('crm_multiproyecto'));"

# Tamano de tablas individuales
sudo -u postgres psql -d crm_multiproyecto -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;"
```

### Recursos del sistema

```bash
# Espacio en disco
df -h

# Uso de memoria
free -m

# Procesos que mas consumen
top -b -n 1 | head -20

# Uso de CPU por PM2
pm2 monit
```

### Health check rapido

```bash
# Verificar todos los servicios de una vez
echo "=== Nginx ===" && sudo systemctl is-active nginx
echo "=== PostgreSQL ===" && sudo systemctl is-active postgresql
echo "=== PM2 (crm-api) ===" && pm2 pid crm-api && echo "running" || echo "stopped"
echo "=== Health endpoint ===" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
echo ""
echo "=== Disco ===" && df -h /
echo "=== Memoria ===" && free -m | grep Mem
```

---

## 9. Renovacion SSL

### Renovacion automatica

Certbot configura automaticamente un timer de systemd o cron para renovar los certificados. Verificar que esta activo:

```bash
# Verificar timer de systemd
sudo systemctl status certbot.timer

# Verificar que la renovacion funciona (sin ejecutar realmente)
sudo certbot renew --dry-run
```

### Renovacion manual

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Cron de respaldo (si la renovacion automatica no esta configurada)

```bash
sudo crontab -e
# Agregar: renovar cada 2 meses, el dia 1 a medianoche
0 0 1 */2 * certbot renew --post-hook "systemctl reload nginx" >> /var/log/certbot-renew.log 2>&1
```

### Verificar fecha de expiracion

```bash
sudo certbot certificates
```

---

## 10. Seguridad del servidor

### PostgreSQL: solo acceso local

Verificar en `/etc/postgresql/14/main/postgresql.conf`:

```conf
listen_addresses = 'localhost'
```

Verificar en `/etc/postgresql/14/main/pg_hba.conf`:

```conf
# Solo conexiones locales
local   all   all                 peer
host    all   all   127.0.0.1/32  md5
host    all   all   ::1/128       md5
```

```bash
sudo systemctl restart postgresql
```

### Firewall UFW

```bash
# Estado actual
sudo ufw status verbose

# Solo permitir puertos necesarios
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirige a HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSH: autenticacion por clave

Editar `/etc/ssh/sshd_config`:

```conf
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

```bash
sudo systemctl restart sshd
```

> **Importante:** Antes de deshabilitar PasswordAuthentication, asegurate de que tu clave publica SSH esta configurada correctamente en `~/.ssh/authorized_keys` y que puedes iniciar sesion con ella.

### Permisos del archivo .env

```bash
chmod 600 /var/www/crm/backend/.env
```

### Node.js nunca expuesto directamente

Node.js escucha solo en `127.0.0.1:3001`. Todo el trafico externo pasa por Nginx en el puerto 443. El puerto 3001 no esta abierto en el firewall.

### Fail2ban para proteccion contra fuerza bruta SSH

```bash
sudo apt install fail2ban -y

sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verificar estado
sudo fail2ban-client status sshd
```

### Actualizaciones de seguridad automaticas

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

Verificar configuracion en `/etc/apt/apt.conf.d/50unattended-upgrades`:

```conf
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
```

### Checklist de seguridad

- [ ] PostgreSQL escucha solo en localhost
- [ ] UFW activo con solo puertos 22, 80, 443
- [ ] SSH con autenticacion por clave (password deshabilitado)
- [ ] `.env` con permisos 600
- [ ] Node.js detras de Nginx (puerto 3001 no expuesto)
- [ ] Fail2ban activo para SSH
- [ ] Actualizaciones de seguridad automaticas habilitadas
- [ ] Certificado SSL activo y con renovacion automatica
- [ ] Headers de seguridad configurados en Nginx
- [ ] Rate limiting configurado para webhooks
