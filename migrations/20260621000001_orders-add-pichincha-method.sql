-- Migration: add PICHINCHA to orders.payment_method check
--
-- The storefront now shows Pichincha as a SINGLE combined option (QR DeUna
-- image + bank transfer details) instead of two separate options. The new
-- value `PICHINCHA` is the canonical e-commerce method going forward.
-- `TRANSFERENCIA_PICHINCHA` and `QR_PICHINCHA` are retained in the enum
-- for backwards compatibility with historical orders.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'EFECTIVO',
    'QR_DEUNA',
    'TRANSFERENCIA',
    'PICHINCHA',
    'TRANSFERENCIA_PICHINCHA',
    'QR_PICHINCHA',
    'TRANSFERENCIA_GUAYAQUIL',
    'PAYPAL'
  ));
