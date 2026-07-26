-- Migration: payment_config method enable/disable toggles
--
-- Admins need a kill switch for each payment method: even when account
-- data is fully configured, the store should be able to hide the method
-- from the checkout (e.g. temporarily stop accepting PayPal while keeping
-- the historical config in the DB). Three independent boolean columns
-- with DEFAULT TRUE preserve the previous behavior for the existing row —
-- every method that is currently visible stays visible until an admin
-- explicitly disables it.
--
-- No RLS change: payment_config UPDATE is already restricted to
-- (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' from
-- migration 20260613000000. The new columns inherit that policy.
--
-- Read access is already `USING (true) TO authenticated`, so the
-- storefront / POS / reservations pages can read the toggles.

ALTER TABLE public.payment_config
  ADD COLUMN IF NOT EXISTS pichincha_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS guayaquil_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS paypal_enabled    BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.payment_config.pichincha_enabled IS
  'When false, the Banco Pichincha / DeUna option is hidden from checkout. Admin toggle.';
COMMENT ON COLUMN public.payment_config.guayaquil_enabled IS
  'When false, the Banco Guayaquil option is hidden from checkout. Admin toggle.';
COMMENT ON COLUMN public.payment_config.paypal_enabled IS
  'When false, the PayPal option is hidden from checkout. Admin toggle.';
