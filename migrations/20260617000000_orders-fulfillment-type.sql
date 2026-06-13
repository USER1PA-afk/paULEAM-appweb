-- Add fulfillment_type to orders.
-- ENVIO: inventory deducted when admin approves (existing behaviour).
-- RETIRO_EN_PLANTA: inventory deducted when operator confirms physical pickup.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'ENVIO'
    CHECK (fulfillment_type IN ('ENVIO', 'RETIRO_EN_PLANTA'));
