-- ============================================================
-- Migración 056: añadir 'whatsapp' al enum utm_channel
-- ============================================================
-- Caso de uso: el lead llegó por WhatsApp directo (sin pasar por
-- meta_ads / google_ads). Antes no se podía distinguir.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'whatsapp'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'utm_channel')
  ) THEN
    ALTER TYPE utm_channel ADD VALUE 'whatsapp';
  END IF;
END$$;
