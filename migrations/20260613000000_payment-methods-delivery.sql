-- Migration: payment_config table + extend orders for multi-payment + delivery date
-- payment_config is a single-row table (id=1). Admin-only writes enforced by RLS.
-- No INSERT/DELETE policies — the seeded row is permanent.

-- 1. payment_config
CREATE TABLE IF NOT EXISTS public.payment_config (
  id                     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pichincha_holder       TEXT,
  pichincha_account      TEXT,
  pichincha_account_type TEXT DEFAULT 'Ahorro',
  pichincha_cedula       TEXT,
  pichincha_qr_path      TEXT DEFAULT '/pichincha-qr.png',
  guayaquil_holder       TEXT,
  guayaquil_account      TEXT,
  guayaquil_account_type TEXT DEFAULT 'Ahorro',
  guayaquil_cedula       TEXT,
  paypal_email           TEXT,
  paypal_me              TEXT,
  updated_at             TIMESTAMPTZ DEFAULT now(),
  updated_by             UUID REFERENCES auth.users(id)
);

INSERT INTO public.payment_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (required at checkout to display account details)
CREATE POLICY "payment_config_select" ON public.payment_config
  FOR SELECT TO authenticated USING (true);

-- Only admins can update — DB-level enforcement, not just frontend
CREATE POLICY "payment_config_update" ON public.payment_config
  FOR UPDATE TO authenticated
  USING    ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 2. Extend payment_method check constraint on orders to include new methods
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'EFECTIVO',
    'QR_DEUNA',
    'TRANSFERENCIA',
    'TRANSFERENCIA_PICHINCHA',
    'QR_PICHINCHA',
    'TRANSFERENCIA_GUAYAQUIL',
    'PAYPAL'
  ));

-- 3. Add delivery_date to orders (NULL = no scheduled delivery, set at order creation)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
