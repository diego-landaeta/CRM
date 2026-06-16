-- 087 — Añade el valor 'proxima_convocatoria' al enum lead_status.
-- Caso de uso: lead interesado que espera a la próxima convocatoria/cohorte
-- (no es "no interesado" pero tampoco está en seguimiento activo).
--
-- ADD VALUE es NO transaccional en PostgreSQL pre-12; con IF NOT EXISTS
-- (PG 9.6+) es idempotente.

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'proxima_convocatoria';
