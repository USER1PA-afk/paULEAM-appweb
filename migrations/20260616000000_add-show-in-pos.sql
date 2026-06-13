-- Add POS visibility flag to products (default true = visible)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS show_in_pos BOOLEAN NOT NULL DEFAULT TRUE;

-- Expose in stock_summary view if it re-selects products.*; nothing to do here
-- since the view uses SELECT p.* … the new column is automatically included.

COMMENT ON COLUMN products.show_in_pos IS
  'When false, this product is hidden from the POS kiosk grid regardless of stock or price.';
