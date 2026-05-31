# BACKUP — procedimiento CRM hermano (PREPRODUCCIÓN)

> ⚠️ **Este backup es SOLO para preproducción/testing, NO para producción.**
> Producción tiene su propio backup automático (cron diario en `/var/backups/crm/*.sql.gz` del VPS 187.124.128.126 — no se toca desde acá).
>
> Este flujo sirve para:
> - Levantar copia de preprod local o en otro server
> - Snapshot del repo para una IA/dev que va a probar cambios
> - Restore puntual para testing
> - Anonimizar datos antes de compartir con tercero

---

## Qué se respalda

| Componente | Origen | Tamaño | Script |
|---|---|---|---|
| **Repo código + .git + docs** | local (Windows) | ~140 MB | `Claude/scripts/backup_repo.sh` |
| **DB anonimizada** (emails/teléfonos hasheados) | preprod opcional | variable | `Claude/scripts/backup_db_anon.sh` |

⛔ NO incluido:
- `.env` con credenciales reales
- `node_modules/`, `dist/`
- Datos reales sin anonimizar de leads/clientes (PII)
- Uploads originales con info personal

---

## Quickstart

```bash
# Repo (no necesita SSH)
bash Claude/scripts/backup_repo.sh
# → ./backups/repo_YYYYMMDD_HHMM.tgz
```

DB anonimizada (requiere DB preprod local separada — NO la prod):

```bash
# Ejemplo: respaldar la DB de staging preprod_db local
bash Claude/scripts/backup_db_anon.sh localhost crm_test_db_preprod
# → ./backups/db_anon_YYYYMMDD_HHMM.dump
```

---

## Scripts incluidos en `Claude/scripts/`

- `backup_repo.sh` — tarball del repo (sin node_modules/dist/env)
- `backup_db_anon.sh` — dump con PII anonimizada
- `restore_db.sh` — restaura un dump a DB destino (refuse si destino es prod)

---

## Restore en preprod local

```bash
# 1) Repo
tar -xzf backups/repo_20260531_1830.tgz -C ~/test/
cd "~/test/CRM ISEIH"
cd backend && npm install && cp .env.example .env  # editar con DB local
cd ../frontend && npm install

# 2) DB
createdb crm_hermano_test
bash Claude/scripts/restore_db.sh ./backups/db_anon_20260531_1830.dump crm_hermano_test

# 3) Levantar
cd backend && npm run dev   # :3001
cd ../frontend && npm run dev  # :5173
```

---

## Reglas críticas

1. **NUNCA correr `backup_db_anon.sh` apuntando a `crm_prod_db` o `crm_test_db`** sin tener una preprod separada
2. **Los scripts tienen safety**: refuse si detectan host `187.124.128.126` o DB `crm_prod_db`/`crm_test_db`
3. **NUNCA committear** `.dump` ni `.tgz` al repo (ya están en `.gitignore`)
4. **Para snapshot de prod** usar el cron automático del VPS:
   ```bash
   ssh claude@187.124.128.126 "ls -lh /var/backups/crm/*.sql.gz | tail"
   scp claude@187.124.128.126:/var/backups/crm/crm_prod_db_LAST.sql.gz ./backups/
   ```
