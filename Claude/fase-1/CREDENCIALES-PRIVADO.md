# CREDENCIALES - SOLO REPO PRIVADO

> **ESTE ARCHIVO NO SE SUBE AL REPO PUBLICO**
> Mover a repo privado cuando se cree

---

## VPS (Hostinger)

| Campo | Valor |
|-------|-------|
| IP | 187.124.128.126 |
| SSH Port | 22 |
| User root | root / <<VPS_ROOT_PASS — ver credenciales fuera de repo>> |
| User claude | claude / ClaudeCRM2026! |
| SSH Key | ED25519 (Diego@LAPTOP-HPPO8T3H) |

## PostgreSQL 17

| Campo | Valor |
|-------|-------|
| Host (servidor) | 187.124.128.126:5432 |
| Database | crm_db |
| User | crm_user |
| Password | CrmDB2026!Secure |
| Encoding | UTF-8 |
| Auth | scram-sha-256 |

### Conexion desde pgAdmin (tunel SSH)

El puerto 5432 no es accesible directo desde fuera (ISP/Hostinger lo bloquea).
Usar tunel SSH para conectar:

```bash
ssh -f -N -L 15432:localhost:5432 claude@187.124.128.126
```

Luego en pgAdmin:
- Host: 127.0.0.1
- Port: 15432
- Database: crm_db
- User: crm_user
- SSL mode: disable

## Entornos Servidor

| Entorno | URL | Backend | DB | Nginx config |
|---------|-----|---------|-----|-------------|
| Production | ip/crm | localhost:3001 | crm_db | /etc/nginx/sites-available/crm |
| Staging | ip/testeo_crm | localhost:3002 | crm_test_db | mismo archivo |
| Health | ip/health | — | — | retorna "OK" |

### Nginx
- Version: 1.26.3
- Config: /etc/nginx/sites-available/crm
- HTTPS: pendiente (necesita dominio + Certbot)
- Preparado para subdominios: crm.dominio.com / test.crm.dominio.com

### Directorios
- Frontend prod: /var/www/crm/production/frontend
- Frontend staging: /var/www/crm/staging/frontend
- Logs: /var/log/crm/{production,staging}

## Pendientes (agregar cuando se configuren)

- Cloudflare R2 (ACCESS_KEY_ID, SECRET_ACCESS_KEY)
- Brevo API Key
- Meta Marketing API token
- Google OAuth2 credentials
- Stripe Restricted Key
- Claude API Key
- JWT_SECRET
- ENCRYPTION_KEY (AES-256)
