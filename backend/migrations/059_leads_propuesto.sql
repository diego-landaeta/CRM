-- ============================================================
-- Migración 059: flag "propuesto"
-- ============================================================
-- Cuando un cliente ya convertido vuelve a preguntar por OTRO producto,
-- el lead nuevo no es reincidente (otro producto) pero tampoco es solo
-- duplicado: es una oportunidad de cross-sell. Lo marcamos como propuesto.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS es_propuesto BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS propuesto_de INTEGER REFERENCES leads(id) ON DELETE SET NULL;

COMMENT ON COLUMN leads.es_propuesto IS 'true si el email ya pertenece a un cliente convertido y ahora pregunta por otro producto (cross-sell).';
COMMENT ON COLUMN leads.propuesto_de IS 'Id del lead original (convertido) del que viene la propuesta.';

CREATE INDEX IF NOT EXISTS idx_leads_propuesto ON leads(project_id, es_propuesto) WHERE es_propuesto = true;
