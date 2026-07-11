-- Migration: add guayaquil_qr_key to payment_config
--
-- The `payment-qr` bucket and its RLS policies (insert/select/update/delete)
-- were created in migration 20260621000000 and are path-agnostic — they apply
-- to any object inside the bucket. The `/api/payment-qr/[...path]` proxy route
-- also resolves any sub-path. No new bucket or policies are required.

ALTER TABLE public.payment_config
  ADD COLUMN IF NOT EXISTS guayaquil_qr_key TEXT;

COMMENT ON COLUMN public.payment_config.guayaquil_qr_key IS
  'Storage key (bucket-relative path) of the Banco Guayaquil QR image. NULL = no QR uploaded yet.';
