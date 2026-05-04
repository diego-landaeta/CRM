-- ============================================================
-- 029: Vistas personalizadas por usuario (CRM-301)
-- Cada usuario configura su propia vista del CRM (sidebar items
-- ocultos, columnas de listados, widgets de dashboard, filtros guardados,
-- densidad, tema). Hereda defaults del proyecto si no hay override.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = preferencia global del usuario
  hidden_sidebar_items TEXT[] DEFAULT '{}',
  lead_columns_override JSONB,         -- override de project.lead_columns para este user
  client_columns_override JSONB,
  dashboard_widgets JSONB DEFAULT '[]'::jsonb,  -- [{key, position, size, visible}]
  saved_filters JSONB DEFAULT '[]'::jsonb,      -- [{id, name, scope, filters: {}}]
  table_density VARCHAR(10) NOT NULL DEFAULT 'comfortable' CHECK (table_density IN ('compact', 'comfortable')),
  theme_preference VARCHAR(10),         -- 'light' | 'dark' | NULL (usar default device)
  language VARCHAR(5) NOT NULL DEFAULT 'es',
  notes JSONB,                           -- campo libre para extensiones futuras
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una preferencia global + opcionalmente una por proyecto
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_views_user_project
  ON user_views (user_id, COALESCE(project_id, 0));

ALTER TABLE user_views OWNER TO crm_user;
ALTER SEQUENCE user_views_id_seq OWNER TO crm_user;
