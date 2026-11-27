-- Ajustes de facturacion automatica y su auditoria desde la pantalla (#1202).
-- Hoy todo sale de 9 variables del .env; cada columna/fila de aqui manda por
-- encima del .env cuando existe. Sin filas, el comportamiento no cambia nada.

-- Interruptor por campus. Sin fila para un campus = se usa la logica de hoy
-- (FACTURA_AUTOMATICA_ACTIVA + FACTURA_AUTOMATICA_CAMPUS). Con fila, manda `activo`.
CREATE TABLE IF NOT EXISTS factura_automatica_campus (
  project_id  INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  activo      BOOLEAN NOT NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajustes globales, fila unica (id=1). Cada columna NULL = sin ajustar desde
-- la pantalla todavia: se usa el .env o el valor de serie.
CREATE TABLE IF NOT EXISTS ajustes_facturacion (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dias               SMALLINT CHECK (dias BETWEEN 1 AND 30),
  enviar_pdf         BOOLEAN,
  revision_admin     BOOLEAN,
  auditoria_activa   BOOLEAN,
  auditoria_pausar   BOOLEAN,
  auditoria_correos  TEXT,
  auditoria_desde    DATE,
  updated_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['crm_user', 'crm_iseie_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH t IN ARRAY ARRAY['factura_automatica_campus', 'ajustes_facturacion'] LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', t, r);
      END LOOP;
    END IF;
  END LOOP;
END $$;