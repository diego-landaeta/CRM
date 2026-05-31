# HANDOFF — CRM hermano (esos2dev-oss/CRM)

> **Para cualquier IA o dev que entra a este repo por primera vez.**
> Leé este doc completo antes de tocar nada. Te ahorra horas de descubrir cosas a los golpes.

Última actualización: 2026-05-29

---

## 1. Identidad del proyecto

| | |
|---|---|
| Nombre | CRM hermano · 360crm.tech |
| Tipo | CRM multi-proyecto (Psiko Aprende, ICTESS, ISEIH, Fono Aprende, Psicólogo IA, etc.) |
| Repo | `esos2dev-oss/CRM` (privado) |
| Stack | Node.js 24 + Express + PostgreSQL 17 + React 18 + Vite + Tailwind |
| Producción | `https://360crm.tech/crm/` |
| Staging | `https://360crm.tech/testeo/` |
| Hermano | Existe otro CRM más simple para un solo proyecto: `esos2dev-oss/CRM-ISEIE` en `https://crm.iseie.com` |

---

## 2. Infraestructura (server)

| | Valor |
|---|---|
| VPS | `187.124.128.126` (Hostinger KVM, Ubuntu 25.04, 4GB RAM, 48GB disk) |
| SSH user principal | `claude` (key auth ED25519, sudo NOPASSWD) |
| SSH user fallback | `root` (password en 1Password/Bitwarden — no en repo) |
| Node | `v24.14.1` via nvm (path: `/home/claude/.nvm/versions/node/v24.14.1/bin`) |
| PM2 | `6.0.14` con systemd startup (corre como user `claude`) |
| Nginx | `1.26.3` (config en `/etc/nginx/sites-enabled/crm`) |
| HTTPS | Let's Encrypt + certbot.timer auto-renew |
| PostgreSQL | `17.7` local, puerto 5432 **bloqueado externamente** por ISP — SSH tunnel obligatorio |

### Conectar desde local

```bash
# Comandos en server
ssh claude@187.124.128.126

# Tunnel para pgAdmin/DBeaver (puerto 5432 local mapea al remoto)
ssh -L 5433:localhost:5432 claude@187.124.128.126
# luego conectar pgAdmin/DBeaver a 127.0.0.1:5433
```

### Bases de datos

| DB | Uso | PM2 app | Puerto API | Frontend dir |
|---|---|---|---|---|
| `crm_prod_db` | **Producción** (la real) | `crm-api-production` | `:3001` | `/var/www/crm/production/frontend/` |
| `crm_test_db` | Staging/QA | `crm-api-staging` | `:3002` | `/var/www/crm/staging/frontend/` |
| `crm_db` | **Legacy** (NO USAR) | — | — | — |

**OJO:** alguien creó `crm_db` originalmente y después se migró a `crm_prod_db`. La vieja sigue existiendo con un schema más viejo. **Siempre usar `crm_prod_db` para producción.**

User PG: `crm_user` (credenciales en `/opt/crm/production/.env` y en 1Password). Auth scram-sha-256.

### Backups

`/var/backups/crm/*.sql.gz` — pg_dump diario vía cron. Hacer dump manual antes de migrations grandes.

---

## 3. Credenciales (referencia — valores en 1Password/Bitwarden, NO en repo)

```
═══════════════════════════════════════════════════════════════
CREDENCIALES — NUNCA COMMITEAR. Solo placeholder aquí.
═══════════════════════════════════════════════════════════════

── VPS 187.124.128.126 ──
root pass:        <<VPS_ROOT_PASS>> (1Password "VPS Hostinger CRM")
claude pass:      <<CLAUDE_USER_PASS>> (1Password)
SSH key:          ED25519 (Diego@LAPTOP-HPPO8T3H — pubkey en authorized_keys)

── PostgreSQL ──
user:             crm_user
password:         <<PG_PASS>> (1Password "CRM Postgres prod")
prod DB:          crm_prod_db
staging DB:       crm_test_db

── GitHub ──
owner:            esos2dev-oss
repos:            esos2dev-oss/CRM (este), esos2dev-oss/CRM-ISEIE (hermano)
PAT:              <<GITHUB_PAT>> (rotar tras compartir; 1Password)

── Servicios externos (claves en /opt/crm/production/.env) ──
- Cloudflare R2 (S3-compatible, dossiers PDF) — ACCESS_KEY, SECRET, BUCKET
- Brevo (email transaccional) — BREVO_API_KEY
- Meta Marketing API — META_ACCESS_TOKEN
- Google Ads API — GOOGLE_ADS_CLIENT_ID/SECRET/REFRESH_TOKEN
- Stripe — STRIPE_RESTRICTED_KEY, STRIPE_WEBHOOK_SECRET
- Anthropic (Claude) — ANTHROPIC_API_KEY (módulo claude-chat)
- JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY (AES-256)

═══════════════════════════════════════════════════════════════
```

Para verlos en el server: `ssh claude@187.124.128.126 "sudo cat /opt/crm/production/.env"`

---

## 4. Estructura del repo

```
/
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── modules/      # Un dir por dominio (auth, leads, products, etc.) — ver MODULES.md
│   │   ├── shared/       # config (db, R2), middleware, services, utils
│   │   ├── jobs/         # Cron jobs (reminders, metaSync, googleSync)
│   │   └── app.js        # Express setup
│   ├── migrations/       # SQL secuencial (001_*, 002_*, ...) — última: 064_messaging.sql
│   ├── seeds/            # Seed SQL
│   └── package.json
│
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── modules/      # Un dir por feature — ver MODULES.md
│   │   ├── shared/       # api/, components/, hooks/, lib/
│   │   ├── contexts/     # AuthContext, ProjectContext, ThemeContext
│   │   └── App.jsx       # Router principal
│   └── package.json
│
├── docs/                 # Doc técnica formal (schema, endpoints, arquitectura)
│   ├── 01-esquema-base-datos.md
│   ├── 03-api-endpoints.md
│   ├── 09-deploy-y-ramas.md
│   └── ...
│
├── Claude/               # 👉 ESTA CARPETA — handoff para IAs/devs
│   ├── HANDOFF.md        # ESTE ARCHIVO
│   ├── MODULES.md        # Tabla de cada módulo backend/frontend
│   ├── RECENT-WORK-2026-05.md
│   ├── README.md         # índice
│   └── ...
│
├── scripts/              # Bash scripts (backup, deploy)
└── CLAUDE.md             # Convenciones del proyecto (commit style, naming, etc.)
```

---

## 5. Convenciones obligatorias

- **Idioma del código:** inglés para vars/funciones, español para comentarios cuando aclaran intención de negocio
- **Commits en español**: prefijos `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- **Branches:**
  - `main` = producción (push directo permitido para fixes; cambios grandes via staging primero)
  - `staging` = QA
  - `feat/<nombre>` = features chicos
- **Backend:** ES modules, async/await, queries pg directas (sin ORM), validación Zod, AppError class
- **Frontend:** React 18, Tailwind, shadcn/ui, React Context (no Redux), Recharts para gráficos
- **NUNCA committear:** `.env`, credenciales, `node_modules/`, `dist/`

Ver [CLAUDE.md](../CLAUDE.md) en la raíz para todo el detalle.

---

## 6. Deploy a producción

**Backend** (cambios en `.js`):
```bash
ssh claude@187.124.128.126
cd /opt/crm/production
# Aquí no hay git remoto — el deploy es via tarball desde local:
# (desde local)
cd backend && tar -czf /tmp/backend.tgz src migrations
scp /tmp/backend.tgz claude@187.124.128.126:/tmp/
ssh claude@187.124.128.126 "cd /opt/crm/production && tar -xzf /tmp/backend.tgz && \
  sudo -u claude bash -lc 'export PATH=\$HOME/.nvm/versions/node/v24.14.1/bin:\$PATH && pm2 restart crm-api-production'"
```

**Frontend** (cambios en `.tsx/.jsx`):
```bash
# Local
cd frontend && npm run build
tar -czf /tmp/iseih_dist.tgz -C dist .
scp /tmp/iseih_dist.tgz claude@187.124.128.126:/tmp/
ssh claude@187.124.128.126 "sudo mkdir -p /var/www/crm/production/frontend.new && \
  sudo rm -rf /var/www/crm/production/frontend.new/* && \
  sudo tar -xzf /tmp/iseih_dist.tgz -C /var/www/crm/production/frontend.new && \
  sudo chown -R claude:claude /var/www/crm/production/frontend.new && \
  sudo rm -rf /var/www/crm/production/frontend.old; \
  sudo mv /var/www/crm/production/frontend /var/www/crm/production/frontend.old && \
  sudo mv /var/www/crm/production/frontend.new /var/www/crm/production/frontend"
```

**Migraciones DB**:
```bash
ssh claude@187.124.128.126 "PGPASSWORD=<<PG_PASS>> psql -h localhost -U crm_user -d crm_prod_db -f /opt/crm/production/migrations/NNN_xxx.sql"
```

**No skip hooks** del git, **no `--no-verify`**, **no `--force-push`** a main/staging.

---

## 7. Cómo levantar el proyecto en local

```bash
# 1) Backend
cd backend
cp .env.example .env  # Editar con DATABASE_URL local + claves de servicios
npm install
npm run dev  # nodemon en :3001

# 2) Migraciones en DB local
psql -U crm_user -d crm_db -f migrations/001_initial_schema.sql
# (correr todas en orden)

# 3) Frontend
cd ../frontend
npm install
npm run dev  # Vite en :5173
```

---

## 8. Roles y RBAC

- **superadmin** — acceso total, crea/desactiva usuarios
- **admin** — operativo total, no gestiona users
- **gestor** — solo proyectos asignados, solo sus leads
- **soporte** — read-only en muchos contextos

Middleware chain: `verifyToken` → `roleGuard` → `projectAccess`.

JWT access token = 15min en `Authorization: Bearer`. Refresh = 30 días en cookie httpOnly.

---

## 9. Reglas de negocio críticas

### Leads
- **Round-robin** en transacción PostgreSQL (`BEGIN`/`COMMIT`). Nunca fuera.
- **Solo gestores** entran al round-robin (no admins ni superadmins) — bug fixed 2026-05
- **Webhook < 500ms**: email Brevo async, respuesta al formulario inmediata
- **Duplicados por email**: NO bloquean creación, marcan `lead_duplicado_de`
- Gestores inactivos (`is_available=false`) se saltan en RR

### Conversiones
- **No redondear nunca**. `importe_total` se ajusta a suma exacta de cuotas
- Eliminar conversión **exige motivo** (duplicada/error_carga/anulacion_cliente/otro). Va a `lead_interactions` antes de soft-delete
- Gestor puede borrar pagos propios (ownership check)
- Cobrar cuota pide importe + fecha (NO asume hoy)

### Fechas
- pg `setTypeParser(1082)` en `shared/config/db.js` → devuelve DATE como string YYYY-MM-DD
- Frontend `toLocalDate()` en `shared/lib/format.js` → parsea como local time (no UTC)
- **Aplicar SIEMPRE** estos helpers, no `new Date(str)` directo

### Archivos
- Pre-signed URLs R2: 15min expiración, solo usuarios autenticados
- Dossiers versionados — la anterior se marca inactiva, nunca se borra

---

## 10. Trabajo reciente (mayo 2026)

Ver [RECENT-WORK-2026-05.md](./RECENT-WORK-2026-05.md) y [CHANGELOG.md](./CHANGELOG.md).

Resumen:
- ✅ Make webhook entrante con headers de override (X-Asesora-Email, X-Canal)
- ✅ Conversiones: CRUD cuotas, edit conversion, eliminar con motivo, permisos gestor
- ✅ Fusión de leads duplicados (`mergeLeads`)
- ✅ Fix timezone date (pg parser + frontend toLocalDate)
- ✅ Service Worker selfDestroying + killswitch
- ✅ Dominio 360crm.tech con HTTPS
- ✅ Fix Dayana bugs: leads sin programa + recordatorios fallaban
- ✅ Fix `/prospectos` en modo "Todos los proyectos" (i18n routes)
- ✅ Import 154 contactos a ICTESS desde CSV con Origen/Asesora correctos

---

## 11. Pitfalls conocidos (cosas que vas a chocar)

1. **No hay git en `/opt/crm/production/`** — deploy es via tarball, no `git pull`
2. **`crm_db` legacy vs `crm_prod_db` real** — siempre usar `crm_prod_db`
3. **Puerto 5432 bloqueado por ISP** — SSH tunnel obligatorio
4. **fail2ban activo** — varias conexiones SSH fallidas → IP baneada por horas
5. **MSYS path mangling en Git Bash Windows**: `MSYS_NO_PATHCONV=1` antes de `npx vite build --base=/crm/`
6. **Rutas FE están en español** (`/prospectos`, `/clientes`) pero algunos guards usan regex en inglés. Ya parchado pero revisar en nuevos guards
7. **ProductCombobox guarda nombre, no ID** — el form debe resolver nombre→ID antes de submit (ver `LeadFormDialog.handleFormSubmit`)
8. **`<input type="datetime-local">` devuelve `YYYY-MM-DDTHH:MM`** pero el endpoint `/reminders` espera `YYYY-MM-DD` estricto. Hacer `.slice(0,10)` + meter hora en nota
9. **PM2 corre como user `claude`** — restart desde root requiere `sudo -u claude bash -lc 'export PATH=...'`
10. **Cuando se trunca al char N un meta_description** en pages WP es por RankMath template — no es bug nuestro

---

## 12. Cómo verificar que todo está OK después de un deploy

```bash
# Health check
curl -sI https://360crm.tech/crm/api/health

# Bundle nuevo cargado
curl -s https://360crm.tech/crm/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1

# PM2 status
ssh claude@187.124.128.126 "pm2 list | grep crm-api"

# Logs últimos
ssh claude@187.124.128.126 "pm2 logs crm-api-production --lines 30 --nostream --raw | tail"

# Errores 4xx/5xx en nginx
ssh claude@187.124.128.126 "sudo tail -50 /var/log/nginx/access.log | grep -E ' (4|5)[0-9]{2} '"
```

---

## 13. Por dónde seguir

- **Tabla de módulos** → [MODULES.md](./MODULES.md)
- **Estado actual cifras DB** → [CURRENT-STATE.md](./CURRENT-STATE.md)
- **Cambios recientes** → [RECENT-WORK-2026-05.md](./RECENT-WORK-2026-05.md)
- **Sesiones de trabajo históricas** → `project_session_*.md`
- **Decisiones que NO debes repetir** → archivos `feedback_*.md`
- **Pendientes conocidos** → [project_pendientes_post_beta.md](./project_pendientes_post_beta.md)
- **Backlog** → [project_backlog_f4_20260424.md](./project_backlog_f4_20260424.md)

Cuando termines un trabajo, **actualizá `CHANGELOG.md` y `RECENT-WORK-*.md`** así el próximo no tiene que adivinar qué hiciste.
