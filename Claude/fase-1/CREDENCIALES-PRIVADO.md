# CREDENCIALES - SOLO REPO PRIVADO

> **ESTE ARCHIVO NO SE SUBE AL REPO PUBLICO**
> Mover a repo privado cuando se cree

---

## VPS (Hostinger)

| Campo | Valor |
|-------|-------|
| IP | 187.124.128.126 |
| SSH Port | 22 |
| User root | root / 1234567890ASDa, |
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

## Pendientes (agregar cuando se configuren)

- Cloudflare R2 (ACCESS_KEY_ID, SECRET_ACCESS_KEY)
- Brevo API Key
- Meta Marketing API token
- Google OAuth2 credentials
- Stripe Restricted Key
- Claude API Key
- JWT_SECRET
- ENCRYPTION_KEY (AES-256)
