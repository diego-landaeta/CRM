-- ============================================================
-- Migración 062: alias de URLs por producto
-- ============================================================
-- Caso: multi-sitio donde los slugs difieren por idioma (es: master-en-X,
-- mx: maestria-en-X). El webhook necesita resolver el producto aunque
-- venga de la URL del subdominio MX.
--
-- En vez de obligar al admin a editar cada form, dejamos que el CRM
-- "aprenda": cuando un gestor vincula manualmente un lead a un producto,
-- guardamos el slug de la landing_url como alias. La próxima vez que
-- llegue un lead desde esa URL, se vincula solo.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_url_aliases (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url_slug    VARCHAR(255) NOT NULL,
  source_host VARCHAR(255),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, url_slug)
);

CREATE INDEX IF NOT EXISTS idx_product_url_aliases_lookup
  ON product_url_aliases (project_id, url_slug);

CREATE INDEX IF NOT EXISTS idx_product_url_aliases_product
  ON product_url_aliases (product_id);

COMMENT ON TABLE product_url_aliases IS
  'Slugs alternativos de URL que apuntan al mismo producto. Útil cuando ES y MX usan slugs distintos (master/maestria) y queremos que el webhook resuelva ambos al mismo producto del catálogo.';
