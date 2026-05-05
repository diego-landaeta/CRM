# VPS 72.60.90.135 — Estado actual y guía para nuevo CRM

> **⚠️ LEER ANTES DE TOCAR NADA.** Este servidor tiene 8 sitios productivos y varias apps Node corriendo desde hace 48 días sin reinicio. El nuevo CRM se monta **encapsulado**, sin afectar nada de lo que ya está aquí.

---

## 1. Datos básicos del servidor

| | |
|---|---|
| **Hostname** | srv965687 |
| **IP pública** | 72.60.90.135 |
| **OS** | Ubuntu 22.04.5 LTS (jammy) |
| **Kernel** | 5.15.0-173-generic |
| **CPUs** | 2 cores |
| **RAM** | 7.8 GB (uso actual ~900 MB) |
| **Disco** | 100 GB / (uso 8.2 GB → 9 %) |
| **Swap** | 0 — no hay swap configurada |
| **Uptime** | 48 días |
| **Zona horaria** | UTC |

---

## 2. Acceso

```
ssh root@72.60.90.135        # acceso completo (root, password compartido)
ssh ubuntu@72.60.90.135      # usuario sudo preexistente con clave SSH
ssh luis-dev@72.60.90.135    # usuario NUEVO creado para el equipo del CRM
```

### Usuario `luis-dev` (recién creado)
- **Password:** `crm-iseie`
- **Grupos:** `luis-dev`, `sudo`
- **UID/GID:** 1001
- **Home:** `/home/luis-dev`
- Puede usar `sudo` para tareas administrativas (instalar paquetes, configurar servicios propios)

> 🔐 **Recomendación inmediata:** que Luis cambie el password con `passwd` al primer login y, si es posible, suba su clave pública SSH para deshabilitar password auth en su usuario.

---

## 3. ⛔ NO TOCAR — Servicios y apps en producción

### 3.1 Servicios systemd activos (NO detener, NO modificar)

| Servicio | Función |
|---|---|
| `nginx` | Proxy reverso HTTPS, sirve TODOS los sitios |
| `mariadb` (10.6) | DB en `127.0.0.1:3306` — usa varias apps |
| `php8.1-fpm` | PHP de los sitios `opynio.com` / `es.opynio.com` |
| `pm2-root` | Gestor de procesos con 3 apps Node críticas |
| `prerender.service` | Server prerender para SEO |
| `ssh`, `cron`, `unattended-upgrades` | Sistema base |

### 3.2 PM2 — apps Node en producción (gestionadas por root)

```
┌────┬────────────────────┬──────┬────────┐
│ id │ name               │ pid  │ uptime │
├────┼────────────────────┼──────┼────────┤
│ 1  │ prerender-opynio   │ 24248│ 48D    │
│ 2  │ veterinary-ai      │ 940  │ 48D    │
│ 7  │ psicologo-ia-pro   │ 40188│ 47D    │
└────┴────────────────────┴──────┴────────┘
```

**Comando que las administra todas:** `sudo pm2 ...` (NO `luis-dev pm2 ...` — son procesos de root).

### 3.3 Procesos Node escuchando en puertos (NO usar estos puertos)

| Puerto | Proceso | Ruta |
|---|---|---|
| **3001** | node `server.js` | (cwd raíz, prerender simple) |
| **3002** | node prerender | `/var/www/web.opynio.com/prerender/` |
| **3003** | node | `/var/www/app.veterinaryai.ai/server/` |
| **3004** | node | `/var/www/pro.psicologoia.ai/dist/` |

### 3.4 Sitios Nginx activos (12 dominios)

```
/etc/nginx/sites-enabled/
├── app.nutricionistaia.ai      → /var/www/app.nutricionistaia.ai/public/dist  (estático)
├── app.opynio.com              → SPA + backend
├── app.psicologoia.ai          → /var/www/app.psicologoia.ai/public/dist      (estático)
├── app.tarotia.ai              → /var/www/app.tarotia.ai/public/dist          (estático)
├── app.trabajosuniversitarios.ai → /var/www/app.trabajosuniversitarios.ai/public/dist
├── app.veterinaryai.ai         → proxy_pass 127.0.0.1:3003
├── crm                         → bind a IP 72.60.90.135 path /CRM (vacío, reservado)
├── es.opynio.com               → /var/www/es.opynio.com/public  (PHP)
├── opynio.com                  → /var/www/opynio.com  (estático/PHP)
├── pro.psicologoia.ai          → proxy_pass 127.0.0.1:3004
├── web.opynio.com              → SPA + proxy 127.0.0.1:3002 + supabase functions
└── yourcvpassport.com          → SPA + supabase functions
```

### 3.5 Certificados SSL (Let's Encrypt) — NO renovarlos manualmente

`/etc/letsencrypt/live/` contiene certificados para todos los dominios listados arriba.

⚠️ **Atención:** `certbot.service` está actualmente en estado **failed**. Los certs siguen vigentes pero el auto-renew falla. NO es responsabilidad del nuevo CRM, pero el equipo actual debería revisarlo.

### 3.6 Archivos sensibles (NO leer ni mover)

- `/var/www/.env` — variables globales compartidas entre apps
- `/var/www/pro.psicologoia.ai.env.backup` — backup
- `/root/.ssh/`, `/root/.pm2/`, `/root/.npm/`, `/root/.nvm/` — entorno root
- `/etc/letsencrypt/` — certificados

---

## 4. ✅ Lo que SÍ puede usar el nuevo CRM

### 4.1 Recursos disponibles

- **CPU:** baja carga (load avg ~0.04)
- **RAM:** 6.6 GB libres
- **Disco:** 89 GB libres
- **Hay margen de sobra** para una app más

### 4.2 Stack instalado y reutilizable

| Herramienta | Versión | Comentario |
|---|---|---|
| Node.js | v20.19.6 (`/usr/bin/node`) | Vía nvm también disponible en root |
| npm | 10.8.2 | |
| PM2 | 6.0.14 (`/usr/local/bin/pm2`) | Global |
| nginx | 1.18.0 | Compartido — añadir nuevo sitio en `sites-available` |
| Git | 2.34.1 | |
| Python3 | 3.10.12 | |
| MariaDB | 10.6.22 | Compartida — crear DB y usuario propios |

### 4.3 Lo que NO está instalado (instalar si se necesita)

- ❌ **PostgreSQL** — no instalado. Si el CRM ISEIH lo requiere (lo requiere): `sudo apt install postgresql-15`
- ❌ **Docker** — no instalado
- ❌ **Redis** — no instalado
- ❌ **pnpm / yarn** — no instalados (usar npm)

### 4.4 Puertos libres recomendados

Los puertos 3001-3004 están ocupados. Para el nuevo CRM usar:
- **3005, 3006, 3007** — recomendados para backend/frontend del nuevo CRM
- 5432 si se instala PostgreSQL (estándar)

### 4.5 Firewall (UFW activo)

```
22/tcp   ALLOW  (SSH)
80/tcp   ALLOW
443/tcp  ALLOW
```

⚠️ Solo 22, 80 y 443 están abiertos al exterior. El nuevo CRM debe ir **detrás de nginx** en un subdominio. NO abrir puertos extras al exterior.

---

## 5. Convenciones para el nuevo CRM

### 5.1 Estructura de directorios sugerida

```bash
# NO usar /var/www/crm (existe vacío pero está reservado/ambiguo)
sudo mkdir -p /opt/crm-iseih               # backend
sudo mkdir -p /var/www/crm-iseih           # frontend estático
sudo chown luis-dev:luis-dev /opt/crm-iseih /var/www/crm-iseih
```

### 5.2 Base de datos PostgreSQL (recomendado para el nuevo CRM)

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql
```
```sql
CREATE USER crm_iseih_user WITH PASSWORD '<password seguro>';
CREATE DATABASE crm_iseih OWNER crm_iseih_user;
\q
```

PostgreSQL escucha por defecto en `127.0.0.1:5432` — no expuesto al exterior, perfecto.

### 5.3 Alternativa: usar MariaDB existente

Si el equipo prefiere MariaDB:
```bash
sudo mariadb
```
```sql
CREATE DATABASE crm_iseih CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crm_iseih_user'@'localhost' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON crm_iseih.* TO 'crm_iseih_user'@'localhost';
FLUSH PRIVILEGES;
```

⚠️ **No tocar** las DBs existentes. `SHOW DATABASES;` para confirmar nombres ya en uso antes de crear.

### 5.4 Nginx — añadir nuevo sitio

```bash
sudo nano /etc/nginx/sites-available/crm-iseih.midominio.com
```

```nginx
server {
    listen 80;
    server_name crm-iseih.midominio.com;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/crm-iseih.midominio.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d crm-iseih.midominio.com    # SSL automático
```

### 5.5 PM2 propio para luis-dev (NO mezclar con root)

```bash
# Como luis-dev (sin sudo)
pm2 start ecosystem.config.js --name crm-iseih-api
pm2 save
pm2 startup    # te dará un comando con sudo — ejecutarlo
```

Esto crea `pm2-luis-dev.service` independiente del `pm2-root.service` que ya existe. Ambos coexisten sin problemas.

---

## 6. Comandos útiles y de diagnóstico (lectura, sin riesgo)

```bash
# Ver qué hay corriendo
sudo systemctl list-units --type=service --state=running
sudo pm2 list                         # apps de root
pm2 list                              # apps de tu usuario
sudo ss -tlnp                         # puertos en uso

# Ver logs
sudo tail -f /var/log/nginx/access.log
sudo journalctl -u nginx -f
sudo pm2 logs                         # apps de root

# Ver config nginx completa
sudo nginx -T
```

---

## 7. Resumen ejecutivo — qué puede y qué no puede hacer luis-dev

| Acción | ¿Permitido? |
|---|---|
| Instalar paquetes nuevos (postgresql, redis, etc.) | ✅ Sí, con `sudo apt install` |
| Crear sus directorios en `/opt/crm-iseih`, `/var/www/crm-iseih` | ✅ Sí |
| Añadir un sitio en `/etc/nginx/sites-available/` propio | ✅ Sí — y reload nginx |
| Crear su propio `pm2-luis-dev.service` con sus apps | ✅ Sí |
| Crear DB y usuario nuevos en MariaDB o PostgreSQL | ✅ Sí |
| Usar puertos 3005, 3006, 3007 para sus apps | ✅ Sí |
| Configurar SSL con certbot para sus subdominios | ✅ Sí |
| Detener/modificar apps PM2 de root (`prerender-opynio`, `psicologo-ia-pro`, `veterinary-ai`) | ❌ NO |
| Modificar configs nginx de los sitios existentes | ❌ NO |
| Tocar `/var/www/.env` | ❌ NO |
| Modificar usuarios `root` o `ubuntu` | ❌ NO |
| Cambiar reglas de UFW para abrir puertos al exterior | ❌ NO |
| Detener `mariadb`, `nginx`, `php8.1-fpm` | ❌ NO |
| Borrar archivos en `/var/www/*` excepto el suyo | ❌ NO |

---

## 8. Contactos y trazabilidad

- VPS proveedor: Hostinger (KVM)
- Usuario creado: `luis-dev` (UID 1001) — auditoría 2026-05-05
- Auditoría realizada: 2026-05-05 21:40 UTC

Cualquier cambio del nuevo equipo debe quedar bajo `/opt/crm-iseih/` o `/var/www/crm-iseih/` y **no debe modificar nada del listado en sección 3**.
