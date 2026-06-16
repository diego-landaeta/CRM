-- ============================================================
-- 085 — Modo importer "cpt_only": sitios WP con CPTs custom pero SIN WooCommerce.
--       Caso ISAEG: usa mu-plugin con token en query string (no Basic Auth),
--       y ACF se lee de un endpoint custom (?read_meta=TOKEN&post_id=N).
-- ============================================================
-- Cambios:
--   1) source_strategy admite 'cpt_only'
--   2) wp_query_token VARCHAR(100) — valor del token (ej "isaeg_2026")
--   3) wp_query_token_param VARCHAR(50) DEFAULT '_token' — nombre del param
--   4) wp_meta_endpoint VARCHAR(200) — patrón "?read_meta=TOKEN&post_id={id}"
--      (opcional; si está, se usa para hidratar ACF cuando el ACF estándar viene vacío)
-- Idempotente.
-- ============================================================

BEGIN;

-- 1) Extender enum de source_strategy
ALTER TABLE wc_credentials
  DROP CONSTRAINT IF EXISTS chk_wc_source_strategy;
ALTER TABLE wc_credentials
  ADD CONSTRAINT chk_wc_source_strategy
  CHECK (source_strategy IN ('wc_only', 'wc_plus_cpt', 'cpt_only'));

-- 2) Auth alternativa por token en query string
ALTER TABLE wc_credentials
  ADD COLUMN IF NOT EXISTS wp_query_token       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS wp_query_token_param VARCHAR(50) DEFAULT '_token',
  ADD COLUMN IF NOT EXISTS wp_meta_endpoint     VARCHAR(200);

-- 3) En modo cpt_only no hay WC, así que consumer_key/secret no aplican.
--    Los hacemos NULLABLE; el código existente sigue funcionando porque siempre
--    los manda no-vacíos en wc_only/wc_plus_cpt.
ALTER TABLE wc_credentials
  ALTER COLUMN consumer_key   DROP NOT NULL,
  ALTER COLUMN consumer_secret DROP NOT NULL;

COMMENT ON COLUMN wc_credentials.wp_query_token IS
  'Token de autenticación en query string para sitios sin WC/Basic Auth (ej. mu-plugin estilo ISAEG).';
COMMENT ON COLUMN wc_credentials.wp_query_token_param IS
  'Nombre del parámetro de query del token (default "_token"). Configurable porque cada mu-plugin usa el suyo.';
COMMENT ON COLUMN wc_credentials.wp_meta_endpoint IS
  'Patrón del endpoint para leer meta/ACF custom. Soporta placeholders {token} y {id}. Ej: "/?read_meta={token}&post_id={id}".';

COMMIT;
