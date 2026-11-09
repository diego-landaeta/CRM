-- 249 · Zadarma: llamar desde el CRM y el registro de cada llamada (#137)
--
-- Diego: «Para WhatsApp llamar Zadarma en vez de llamar por WhatsApp». Manuel
-- (05/10): «que se pueda llamar por teléfono normal por el CRM, tener reportes
-- de llamadas, veces que se hace por asesora, duración de llamadas…».
--
-- Tres piezas:
--
--   1. `user_projects.zadarma_extension`: la extensión interna de la centralita
--      con la que llama cada gestora EN ESE CAMPUS. Va en la relación persona ×
--      campus y no en la persona: cada campus conecta su propia cuenta de
--      Zadarma (Integraciones), y la extensión 100 de una cuenta no es la 100
--      de otra. Dentro de un campus, una extensión es de una sola persona.
--
--   2. `llamadas`: cada llamada que termina, tal como la cuenta Zadarma con sus
--      avisos NOTIFY_END (entrante) y NOTIFY_OUT_END (saliente). El id de la
--      llamada de Zadarma (`pbx_call_id`) es único: si el aviso llega dos veces,
--      la segunda no hace nada. Una llamada a un número que no es de ningún
--      prospecto se guarda igual, sin `lead_id` («llamada sin lead»).
--
--   3. `llamadas_pedidas`: cada vez que alguien pulsa «Llamar con Zadarma».
--      Sirve para casar el aviso de fin con el prospecto desde el que se pulsó
--      (dos fichas pueden tener el mismo teléfono) y deja constancia de quién
--      pidió qué llamada.
--
-- Las credenciales (clave y secreto de la API) NO van aquí: van cifradas en
-- `project_integrations` con provider = 'zadarma', como Stripe y Brevo.
--
-- Se puede pasar dos veces.

BEGIN;

ALTER TABLE user_projects ADD COLUMN IF NOT EXISTS zadarma_extension VARCHAR(20);

-- Una extensión, una persona por campus. Parcial: sin extensión no choca nadie.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_projects_zadarma_extension
    ON user_projects (project_id, zadarma_extension)
    WHERE zadarma_extension IS NOT NULL;

CREATE TABLE IF NOT EXISTS llamadas (
    id               SERIAL       PRIMARY KEY,
    project_id       INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    lead_id          INTEGER      REFERENCES leads(id) ON DELETE SET NULL,
    user_id          INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    extension        VARCHAR(20),
    numero           VARCHAR(40)  NOT NULL,
    direccion        VARCHAR(10)  NOT NULL,
    inicio           TIMESTAMPTZ  NOT NULL,
    duracion_seg     INTEGER      NOT NULL DEFAULT 0,
    contestada       BOOLEAN      NOT NULL DEFAULT false,
    estado           VARCHAR(40),
    grabada          BOOLEAN      NOT NULL DEFAULT false,
    call_id_with_rec VARCHAR(120),
    pbx_call_id      VARCHAR(120) NOT NULL,
    interaccion_id   INTEGER      REFERENCES lead_interactions(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT llamadas_direccion CHECK (direccion IN ('saliente', 'entrante')),
    CONSTRAINT llamadas_duracion CHECK (duracion_seg >= 0)
);

-- La idempotencia del aviso: el mismo id de Zadarma no entra dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_llamadas_pbx_call_id ON llamadas (pbx_call_id);
CREATE INDEX IF NOT EXISTS idx_llamadas_campus_inicio  ON llamadas (project_id, inicio);
CREATE INDEX IF NOT EXISTS idx_llamadas_gestora_inicio ON llamadas (user_id, inicio);
CREATE INDEX IF NOT EXISTS idx_llamadas_lead           ON llamadas (lead_id);

COMMENT ON TABLE llamadas IS
  'Llamadas de Zadarma (249, #137): una fila por llamada terminada (NOTIFY_END / NOTIFY_OUT_END); pbx_call_id único.';

CREATE TABLE IF NOT EXISTS llamadas_pedidas (
    id          SERIAL       PRIMARY KEY,
    project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    lead_id     INTEGER      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extension   VARCHAR(20)  NOT NULL,
    numero      VARCHAR(40)  NOT NULL,
    pedida_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llamadas_pedidas_gestora ON llamadas_pedidas (user_id, pedida_at DESC);

COMMENT ON TABLE llamadas_pedidas IS
  'Cada «Llamar con Zadarma» pulsado (249, #137): quién, a qué prospecto y con qué extensión.';

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['crm_user', 'crm_iseie_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON llamadas, llamadas_pedidas TO %I', r);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE llamadas_id_seq, llamadas_pedidas_id_seq TO %I', r);
    END IF;
  END LOOP;
END $$;

COMMIT;
