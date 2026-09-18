-- 181 · Los documentos que se mandan con cada correo del día 1 (#91)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ FALTA HOY
--
-- El documento comercial es tajante con el correo del día 1: van tres adjuntos
-- —el dossier del curso, la guía del campus y las homologaciones— y «sin los
-- tres, el correo no sale».
--
-- El dossier ya existe en el CRM: es de cada curso y vive en `dossiers`. Los
-- otros dos NO están en ninguna parte, y no son del curso: son de la MARCA.
-- La guía del campus de Psiko Aprende es la misma para sus veinte formaciones,
-- y las homologaciones también. Guardarlas por curso sería subir el mismo PDF
-- veinte veces y tener veinte que actualizar el día que cambie.
--
-- Por eso una tabla aparte y no una fila más en `dossiers`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- UNO ACTIVO POR TIPO Y MARCA
--
-- Se versiona como los dossiers: al subir uno nuevo, el anterior se marca
-- inactivo y se queda. No se borra nada — un correo que salió hace dos meses
-- llevaba el de entonces, y saber cuál era es parte de poder responder a una
-- reclamación.
--
-- El índice único es PARCIAL, solo sobre los activos: así puede haber diez
-- versiones viejas de la guía y solo una vigente.

BEGIN;

CREATE TABLE IF NOT EXISTS project_documents (
  id                SERIAL PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Qué documento es. Se deja abierto con un CHECK y no con un ENUM: añadir un
  -- tipo a un ENUM en producción es una migración con bloqueo, y esto va a
  -- crecer (el contrato, la carta de becas...).
  tipo              VARCHAR(40) NOT NULL
                    CHECK (tipo IN ('guia_campus', 'homologaciones', 'otro')),

  -- Dónde está en R2 y cómo se llamaba cuando lo subieron. El nombre original
  -- importa: es el que ve el cliente en el correo, y «guia-campus-v3-FINAL.pdf»
  -- no es lo que queremos que le llegue. Por eso también `nombre_visible`.
  s3_key            VARCHAR(500) NOT NULL,
  filename_original VARCHAR(255) NOT NULL,
  nombre_visible    VARCHAR(160),

  size_bytes        BIGINT,
  version           INTEGER NOT NULL DEFAULT 1,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  subido_por        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uno vigente por marca y tipo. Las versiones viejas quedan, inactivas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_documents_vigente
  ON project_documents (project_id, tipo) WHERE active;

CREATE INDEX IF NOT EXISTS idx_project_documents_proyecto
  ON project_documents (project_id, tipo, active);

-- El #71 otra vez: en producción esto lo corre `postgres` y lo que se cree por
-- el camino nace siendo suyo. Se le da acceso al usuario que exista en esta
-- instalación, igual que en las demás migraciones.
DO $$
DECLARE rol TEXT;
BEGIN
  FOREACH rol IN ARRAY ARRAY['crm_user', 'crm_iseie_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON project_documents TO %I', rol);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE project_documents_id_seq TO %I', rol);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Qué tiene cada marca, y qué le falta para poder mandar el correo del día 1:
--
--   SELECT p.nombre,
--          bool_or(d.tipo = 'guia_campus')    AS tiene_guia,
--          bool_or(d.tipo = 'homologaciones') AS tiene_homologaciones
--     FROM projects p
--     LEFT JOIN project_documents d ON d.project_id = p.id AND d.active
--    GROUP BY p.nombre ORDER BY p.nombre;
