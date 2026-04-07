-- ============================================================
-- Migracion 003: Tabla refresh tokens
-- Ticket: CRM-35 / F1-011
-- Depende de: 001 (users)
-- ============================================================

BEGIN;

CREATE TABLE user_refresh_tokens (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON user_refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON user_refresh_tokens (token_hash) WHERE revoked = false;

COMMIT;
