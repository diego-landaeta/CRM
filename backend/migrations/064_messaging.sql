-- ============================================================
-- 064_messaging.sql — Sistema de mensajeria interna
-- ============================================================

CREATE TABLE conversations (
    id            SERIAL        PRIMARY KEY,
    type          VARCHAR(20)   NOT NULL DEFAULT 'direct'
                                CHECK (type IN ('direct', 'group')),
    title         VARCHAR(255),
    lead_id       INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_participants (
    id                SERIAL        PRIMARY KEY,
    conversation_id   INTEGER       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id           INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at      TIMESTAMPTZ   NOT NULL DEFAULT '1970-01-01T00:00:00Z',
    joined_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conv_participant UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);

CREATE TABLE messages (
    id                 SERIAL        PRIMARY KEY,
    conversation_id    INTEGER       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body               TEXT          NOT NULL CHECK (char_length(body) > 0),
    content_type       VARCHAR(20)   NOT NULL DEFAULT 'text',
    referenced_lead_id INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_conv_type ON conversations(type);
