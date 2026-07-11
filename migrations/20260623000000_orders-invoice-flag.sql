-- ============================================================
-- Persist "Generar comprobante" choice on POS sales
-- ============================================================
-- When the cashier ticks "Generar comprobante" in the POS kiosk and
-- the sale completes, the timestamp is written here so the Sales
-- Orders module can show a "Comprobante generado" badge and re-render
-- the nota de venta from the stored order data (no file upload needed).
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;

-- Helpful index for filtering "orders that produced a receipt".
CREATE INDEX IF NOT EXISTS idx_orders_invoice_generated_at
  ON public.orders(invoice_generated_at)
  WHERE invoice_generated_at IS NOT NULL;

COMMENT ON COLUMN public.orders.invoice_generated_at IS
  'Timestamp set by the POS kiosk when the cashier ticks "Generar comprobante". NULL for orders sold without a receipt. The receipt itself is reproducible from orders + order_items + profiles data.';
