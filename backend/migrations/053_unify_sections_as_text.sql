-- ============================================================
-- Migración 053: simplificar — secciones como TEXT unificado
-- ============================================================
-- En vez de 4 tablas auxiliares con esquema rígido (titulo, horas, orden),
-- guardamos cada sección como un BLOB de texto/HTML asociado al producto.
--
-- Razones:
--   - Cada sitio tiene nombres distintos (Módulos / Temario / Programa /
--     Contenido / Unidades / Bloques). No queremos hardcodear ninguno.
--   - El admin decide en la UI qué keywords disparan qué sección, y el
--     scraper guarda el HTML/texto tal cual.
--   - Si más adelante hace falta estructurar (parsear módulos uno a uno),
--     se hace en frontend a partir del texto guardado.
-- ============================================================

BEGIN;

-- 1) Tirar las 4 tablas auxiliares estructuradas (estaban vacías; migración 052 las creó)
DROP TABLE IF EXISTS product_benefits   CASCADE;
DROP TABLE IF EXISTS product_objectives CASCADE;
DROP TABLE IF EXISTS product_faqs       CASCADE;
DROP TABLE IF EXISTS product_targets    CASCADE;

-- 2) Añadir columnas TEXT por sección al producto (texto unificado o HTML)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS presentacion_texto       TEXT,
  ADD COLUMN IF NOT EXISTS objetivos_texto          TEXT,
  ADD COLUMN IF NOT EXISTS beneficios_texto         TEXT,
  ADD COLUMN IF NOT EXISTS dirigido_a_texto         TEXT,
  ADD COLUMN IF NOT EXISTS para_que_te_prepara_texto TEXT,
  ADD COLUMN IF NOT EXISTS por_que_estudiar_texto   TEXT,
  ADD COLUMN IF NOT EXISTS modulos_texto            TEXT,        -- módulos / temario / programa / contenido / unidades
  ADD COLUMN IF NOT EXISTS metodologia_texto        TEXT,
  ADD COLUMN IF NOT EXISTS faqs_texto               TEXT,
  ADD COLUMN IF NOT EXISTS profesores_texto         TEXT,        -- nombres + bios concatenados
  ADD COLUMN IF NOT EXISTS otras_secciones          JSONB DEFAULT '{}'::jsonb;  -- {clave: texto} para secciones no estándar

COMMENT ON COLUMN products.modulos_texto IS 'Texto/HTML unificado de la sección de módulos. Acepta cualquier nombre origen: Módulos, Temario, Programa, Contenido, Unidades, Bloques, etc.';
COMMENT ON COLUMN products.otras_secciones IS 'Secciones detectadas que no encajan en las columnas fijas. JSONB clave-valor.';

-- 3) Añadir section_keywords a wc_credentials (configurable por proyecto)
ALTER TABLE wc_credentials
  ADD COLUMN IF NOT EXISTS section_keywords JSONB DEFAULT
    '{
      "presentacion":         ["presentaci"],
      "objetivos":            ["objetivo"],
      "beneficios":           ["beneficio"],
      "dirigido_a":           ["dirigido", "para quien", "a quien", "destinatario"],
      "para_que_te_prepara":  ["te prepara", "preparacion", "salidas profesionales", "salida laboral"],
      "por_que_estudiar":     ["por que estudiar", "por que elegir", "ventajas"],
      "modulos":              ["contenido del", "temario del", "programa del", "syllabus", "temario", "contenido", "modulos", "modulo", "unidades", "unidad", "bloques"],
      "metodologia":          ["metodologi"],
      "faqs":                 ["pregunta frecuente", "preguntas frecuentes", "faq", "dudas frecuentes"],
      "profesores":           ["profesor", "docente", "instructor", "tutor", "claustro", "profesorado"]
    }'::jsonb,
  ADD COLUMN IF NOT EXISTS scraper_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scrape_strategy VARCHAR(20) NOT NULL DEFAULT 'plain_text'
    CHECK (scrape_strategy IN ('plain_text', 'preserve_html'));

COMMENT ON COLUMN wc_credentials.section_keywords IS 'Por cada sección lógica del CRM, lista de keywords que el scraper buscará en los <h2> del HTML público del producto. Editable por el admin sin tocar código.';
COMMENT ON COLUMN wc_credentials.scraper_enabled IS 'Si true, el importer descarga el HTML del permalink de cada producto y extrae las secciones via scraping. Útil cuando ACF está vacío.';
COMMENT ON COLUMN wc_credentials.scrape_strategy IS 'plain_text: limpia HTML a texto plano | preserve_html: guarda el HTML interior';

COMMIT;
