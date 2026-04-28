-- ============================================================
-- Migración 033: Custom roles + overrides de permisos por usuario
-- ============================================================

-- Añadir 'soporte' al enum si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'soporte'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'soporte';
  END IF;
END$$;

-- Roles personalizados creados por la instalación
CREATE TABLE IF NOT EXISTS custom_roles (
  id          SERIAL PRIMARY KEY,
  label       VARCHAR(100) NOT NULL,
  description TEXT,
  base_role   VARCHAR(30) NOT NULL DEFAULT 'gestor',  -- rol del que hereda defaults (superadmin/admin/gestor/soporte)
  permissions JSONB NOT NULL DEFAULT '{}',             -- { 'leads.delete': true, 'leads.export': false, ... }
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Overrides de permisos a nivel de usuario individual (anula el rol)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource   VARCHAR(60) NOT NULL,
  action     VARCHAR(30) NOT NULL,
  allowed    BOOLEAN NOT NULL,
  UNIQUE(user_id, resource, action)
);

-- Asignar custom role a usuarios
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_id INTEGER REFERENCES custom_roles(id) ON DELETE SET NULL;

ALTER TABLE custom_roles OWNER TO crm_user;
ALTER SEQUENCE custom_roles_id_seq OWNER TO crm_user;
ALTER TABLE user_permission_overrides OWNER TO crm_user;
ALTER SEQUENCE user_permission_overrides_id_seq OWNER TO crm_user;
