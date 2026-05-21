# Despliegue y estrategia de ramas

## TL;DR

| Rama Git | Entorno | URL | DB | Backend (PM2) | Frontend (Nginx) |
|---|---|---|---|---|---|
| `main` | **Producción** | https://360crm.tech/crm/ | `crm_prod_db` | `crm-api-production` (puerto 3001) | `/var/www/crm/production/frontend` |
| `staging` | **QA / Testeo** | https://360crm.tech/testeo/ | `crm_test_db` | `crm-api-staging` (puerto 3002) | `/var/www/crm/staging/frontend` |
| `feat/*` | Feature branches (PRs) | local | — | — | — |

> **Regla de oro**: nunca commitear directamente a `main`. Trabajar en `feat/<nombre-corto>`, mergear a `staging`, validar QA, luego mergear a `main`.

## Flujo de trabajo

```
   feat/X ──merge──► staging ──validación QA──► main ──deploy─► producción
                       │
                       └──deploy─► staging.360crm.tech (auto)
```

1. **Branch desde `main`** para una nueva feature:
   ```bash
   git checkout main && git pull
   git checkout -b feat/nombre-corto
   ```
2. **Commitear** con mensajes en español con prefijo (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
3. **Merge a `staging`** cuando esté lista localmente:
   ```bash
   git checkout staging && git merge feat/nombre-corto
   ```
4. **Deploy a testeo** (ver sección Deploy).
5. **Probar** en https://360crm.tech/testeo/. Si pasa QA → merge a `main`.
6. **Merge a `main`** y deploy a producción.

## VPS — estructura física

VPS Hostinger `187.124.128.126` (DNS: `360crm.tech` → este IP).

```
/opt/crm/
  production/         # código backend producción
    src/
    .env              # variables prod (NUNCA commitear)
  staging/            # código backend testeo
    src/
    .env              # variables staging

/var/www/crm/
  production/frontend/    # build prod (Vite con VITE_BASE_PATH=/crm/)
  staging/frontend/       # build staging (Vite con VITE_BASE_PATH=/testeo/)

/var/www/360crm-landing/  # landing pública index.html + sitemap + robots

/etc/nginx/sites-enabled/360crm.tech    # config nginx (HTTPS + rutas)
/etc/letsencrypt/live/360crm.tech/      # certificado SSL (renueva certbot.timer)

/var/backups/crm/        # backups DB (gzip pg_dump)
```

PM2 procesos:
- `crm-api-production` → escucha en `127.0.0.1:3001`
- `crm-api-staging` → escucha en `127.0.0.1:3002`

Nginx hace el reverse proxy y termina HTTPS.

## Deploy a STAGING

```bash
# Desde tu máquina local, en la rama staging
git checkout staging

# 1. Backend (rsync los .js a /opt/crm/staging/)
scp -r backend/src/* root@187.124.128.126:/opt/crm/staging/src/

# 2. Frontend (build con .env.staging → VITE_BASE_PATH=/testeo/)
cd frontend
MSYS_NO_PATHCONV=1 npm run build -- --mode staging
scp -r dist/* root@187.124.128.126:/var/www/crm/staging/frontend/

# 3. Reload PM2 (sin downtime)
ssh root@187.124.128.126 \
  "sudo runuser -u claude -- bash -lc \
   'source /home/claude/.nvm/nvm.sh && pm2 reload crm-api-staging'"
```

## Deploy a PRODUCCIÓN

```bash
# Desde tu máquina local, en la rama main
git checkout main

# 1. Backup DB ANTES (precaución)
ssh root@187.124.128.126 \
  "sudo -u postgres pg_dump crm_prod_db | gzip > /var/backups/crm/prod_$(date +%Y%m%d_%H%M%S).sql.gz"

# 2. Backend
scp -r backend/src/* root@187.124.128.126:/opt/crm/production/src/

# 3. Frontend (build default → VITE_BASE_PATH=/crm/)
cd frontend
MSYS_NO_PATHCONV=1 npm run build
scp -r dist/* root@187.124.128.126:/var/www/crm/production/frontend/

# 4. Reload PM2
ssh root@187.124.128.126 \
  "sudo runuser -u claude -- bash -lc \
   'source /home/claude/.nvm/nvm.sh && pm2 reload crm-api-production'"
```

## Migraciones de DB

Las migraciones viven en `backend/migrations/NNN_*.sql` (numeración secuencial). Aplicar SIEMPRE a staging primero, validar, luego a producción.

```bash
# Subir el archivo
scp backend/migrations/063_make_webhooks.sql root@187.124.128.126:/tmp/

# Aplicar a staging
ssh root@187.124.128.126 \
  "sudo -u postgres psql crm_test_db -f /tmp/063_make_webhooks.sql"

# Si OK, aplicar a producción
ssh root@187.124.128.126 \
  "sudo -u postgres psql crm_prod_db -f /tmp/063_make_webhooks.sql"

# Recordar grants si la tabla se crea como user postgres y no crm_user:
ssh root@187.124.128.126 \
  "sudo -u postgres psql crm_prod_db -c \
   'GRANT ALL ON nueva_tabla TO crm_user; \
    GRANT USAGE, SELECT ON SEQUENCE nueva_tabla_id_seq TO crm_user;'"
```

## Variables de entorno (backend)

**No commitear** `.env`. Sí se commitea `.env.example`.

Clave por entorno (en el VPS):

| Var | Prod | Staging |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| `PORT` | `3001` | `3002` |
| `DATABASE_URL` | `postgresql://crm_user:...@localhost:5432/crm_prod_db` | `postgresql://crm_user:...@localhost:5432/crm_test_db` |
| `JWT_SECRET` | (distinto) | (distinto) |
| `CRM_BASE_URL` | `https://360crm.tech/crm` | `https://360crm.tech/testeo` |
| `COOKIE_SECURE` | `true` | `true` |
| `CORS_ORIGIN` | `https://360crm.tech` | `https://360crm.tech` |

## Variables de entorno (frontend)

`.env.production` (default, build sin `--mode`):
```
VITE_BASE_PATH=/crm/
VITE_BETA_MODE=true
```

`.env.staging` (build con `--mode staging`):
```
VITE_BASE_PATH=/testeo/
VITE_BETA_MODE=false
```

`VITE_BETA_MODE=true` esconde rutas no incluidas en `BETA_ROUTES` (allowlist en `src/shared/config/betaConfig.ts`). En staging todo se ve para testear; en prod solo lo aprobado.

## Webhooks de Make / integraciones externas

| Entorno | URL pública |
|---|---|
| Producción | `https://360crm.tech/crm/api/webhooks/make/:slug` |
| Staging | `https://360crm.tech/testeo/api/webhooks/make/:slug` |

Headers soportados además del body:
- `X-Make-Secret`: obligatorio (validado server-side)
- `X-Asesora-Email` / `X-Asesora-Nombre`: fuerza el responsable del lead
- `X-Canal`: canal del lead (whatsapp, instagram, web, email, meta_ads, google_ads…)

## Service Worker

**Actualmente desactivado** (`selfDestroying: true` en `vite.config.js`). Cualquier SW instalado en navegadores se autodesinstala en la próxima visita. Cuando todos los navegadores estén limpios podemos reintroducir PWA con cuidado (especialmente el `navigateFallback` a `offline.html` que causaba pantallas de "Sin conexión").

## Rollback

Si producción se rompe:

```bash
# 1. Restaurar DB
ssh root@187.124.128.126 \
  "gunzip -c /var/backups/crm/prod_YYYYMMDD_HHMMSS.sql.gz | sudo -u postgres psql crm_prod_db"

# 2. Restaurar backend (volver a commit anterior y redeploy)
git checkout main
git revert <commit-malo>     # o git reset --hard <commit-bueno>
# luego seguir el flujo deploy normal

# 3. Reload PM2 sin tirar nada
ssh root@187.124.128.126 \
  "sudo runuser -u claude -- bash -lc \
   'source /home/claude/.nvm/nvm.sh && pm2 reload crm-api-production'"
```

## Onboarding rápido (dev nuevo)

1. Clonar repo, ramear desde `main`.
2. Levantar local con `npm run dev` en `backend/` (puerto 3001) y `frontend/` (puerto 5173).
3. Apuntar `DATABASE_URL` local a una DB postgres propia o pedir acceso al VPS.
4. Leer `docs/01-08*.md` para arquitectura.
5. Convención commits: español + prefijo (ej. `fix(leads): ...`).
6. Antes de mergear a `staging`, ejecutar `npm run lint && npm run typecheck && npm test`.
