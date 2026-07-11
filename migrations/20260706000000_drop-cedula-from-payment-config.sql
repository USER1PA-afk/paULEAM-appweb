-- Drop cedula/RUC columns from payment_config.
-- These fields are no longer collected, stored, or displayed.
ALTER TABLE public.payment_config
  DROP COLUMN IF EXISTS pichincha_cedula,
  DROP COLUMN IF EXISTS guayaquil_cedula;
