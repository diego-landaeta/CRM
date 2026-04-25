-- ============================================================
-- 028: Tablas para audiences, ia metrics, reports, chat IA
-- (CRM-115, CRM-108, CRM-113, CRM-119)
-- ============================================================

-- ====== Meta uploads (CRM-115) ======
CREATE TABLE IF NOT EXISTS meta_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audience_id VARCHAR(100),
  audience_name VARCHAR(255) NOT NULL,
  records_uploaded INTEGER NOT NULL DEFAULT 0,
  match_rate NUMERIC(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'preparing',
  error_message TEXT,
  filters JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meta_uploads_project ON meta_uploads(project_id, started_at DESC);

-- ====== IA metrics snapshots (CRM-108) ======
CREATE TABLE IF NOT EXISTS ia_metrics_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mes VARCHAR(7) NOT NULL,
  mrr NUMERIC(12,2) NOT NULL DEFAULT 0,
  active_subs INTEGER NOT NULL DEFAULT 0,
  new_subs INTEGER NOT NULL DEFAULT 0,
  cancelled_subs INTEGER NOT NULL DEFAULT 0,
  churn_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, mes)
);
CREATE INDEX IF NOT EXISTS idx_ia_snap_project ON ia_metrics_snapshots(project_id, mes DESC);

-- ====== Reports IA (CRM-113) ======
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  periodo VARCHAR(7) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id, periodo DESC);

-- ====== Chat IA (CRM-119) ======
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_project_user ON ai_conversations(project_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at);

-- Owners
ALTER TABLE meta_uploads OWNER TO crm_user;
ALTER TABLE ia_metrics_snapshots OWNER TO crm_user;
ALTER SEQUENCE ia_metrics_snapshots_id_seq OWNER TO crm_user;
ALTER TABLE reports OWNER TO crm_user;
ALTER TABLE ai_conversations OWNER TO crm_user;
ALTER TABLE ai_messages OWNER TO crm_user;
