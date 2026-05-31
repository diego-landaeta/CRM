#!/bin/bash
# Backup ANONIMIZADO de DB CRM hermano para preprod.
# Anonimiza emails (MD5), teléfonos (últimos 4 dígitos), nombres ("Usuario N"),
# notas (vacío) y custom_fields sensibles.
#
# Output: ./backups/db_anon_YYYYMMDD_HHMM.dump (formato pg_dump -Fc)
#
# Uso: bash Claude/scripts/backup_db_anon.sh [DB_HOST] [DB_NAME]
#   default: localhost crm_hermano_preprod
#
# ⚠️ Refuse si apunta a producción.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAMP=$(date +%Y%m%d_%H%M)
OUT_DIR="$REPO_ROOT/backups"
OUT_FILE="$OUT_DIR/db_anon_${STAMP}.dump"

DB_HOST="${1:-localhost}"
DB_NAME="${2:-crm_hermano_preprod}"
DB_USER="${PGUSER:-crm_user}"

# Safety: refuse contra prod conocida
PROD_HOSTS=("187.124.128.126")
PROD_DBS=("crm_prod_db" "crm_test_db" "crm_db")

for h in "${PROD_HOSTS[@]}"; do
  if [[ "$DB_HOST" == "$h" ]]; then
    echo "⛔ REFUSED: host '$DB_HOST' es producción. Usá una DB local de preprod."
    exit 1
  fi
done
for d in "${PROD_DBS[@]}"; do
  if [[ "$DB_NAME" == "$d" ]]; then
    echo "⛔ REFUSED: DB '$DB_NAME' es producción/staging. Creá primero una DB preprod separada."
    echo "   Ej: createdb crm_hermano_preprod"
    exit 1
  fi
done

mkdir -p "$OUT_DIR"

echo "→ Source DB: $DB_USER@$DB_HOST/$DB_NAME"
echo "→ Output:    $OUT_FILE"
echo ""

# 1) DB temporal copia
TMP_DB="${DB_NAME}_anon_tmp_$$"
echo "→ Creando DB temporal: $TMP_DB"
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $TMP_DB TEMPLATE $DB_NAME;"

# 2) Anonimizar
echo "→ Anonimizando emails / teléfonos / nombres / notas..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$TMP_DB" <<'SQL'
-- Emails
UPDATE leads SET email = MD5(email) || '@anon.local' WHERE email IS NOT NULL;
UPDATE users SET email = MD5(email) || '@anon.local' WHERE email IS NOT NULL;

-- Teléfonos: últimos 4 dígitos rellenados con ceros
UPDATE leads SET telefono = LPAD(RIGHT(regexp_replace(telefono, '[^0-9]', '', 'g'), 4), 10, '0')
  WHERE telefono IS NOT NULL;

-- Nombres
UPDATE leads SET nombre = 'Lead ' || id;
UPDATE users SET nombre = 'User ' || id;

-- Notas (PII libre) → vacío
UPDATE leads SET notas = NULL WHERE notas IS NOT NULL;

-- Custom fields: limpiar sensibles
UPDATE leads SET custom_fields = COALESCE(custom_fields, '{}'::jsonb)
  - 'observacion' - 'nombres_alt' - 'emails_alt' - 'telefonos_alt'
  - 'cetlat_id' - 'asesora_csv' - 'tecnico_csv'
  WHERE custom_fields IS NOT NULL;

-- Lead interactions
UPDATE lead_interactions SET nota = '(anonimizado)' WHERE nota IS NOT NULL;

-- Passwords → hash dummy
UPDATE users SET password_hash = '$2b$12$DummyHashForPreprodTestingOnly0000000000000000';

-- Mensajes internos (si existen)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='messages') THEN
    EXECUTE 'UPDATE messages SET content = ''(anonimizado)'' WHERE content IS NOT NULL';
  END IF;
END $$;
SQL

# 3) Dump
echo "→ Generando pg_dump..."
pg_dump -h "$DB_HOST" -U "$DB_USER" -Fc -d "$TMP_DB" -f "$OUT_FILE"

# 4) Cleanup
echo "→ Borrando DB temporal..."
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE $TMP_DB;"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo ""
echo "✅ Backup anonimizado: $OUT_FILE ($SIZE)"
echo ""
echo "Restore:"
echo "  createdb crm_hermano_test"
echo "  bash Claude/scripts/restore_db.sh $OUT_FILE crm_hermano_test"
