-- ============================================================
-- PAuleam ERP — Migración 2/2: Migra filas OTRO → MATERIAL_SECUNDARIO
-- Depende de 20260615000000 (enum ya committed en transacción separada).
-- ============================================================

-- Migrar productos existentes
UPDATE public.products
SET type = 'MATERIAL_SECUNDARIO'
WHERE type = 'OTRO';

-- Actualizar get_low_stock_products para incluir MATERIAL_SECUNDARIO
CREATE OR REPLACE FUNCTION public.get_low_stock_products()
RETURNS TABLE (
  product_id   UUID,
  product_name TEXT,
  product_sku  TEXT,
  product_type public.product_type,
  unit         TEXT,
  stock_actual NUMERIC,
  min_stock    NUMERIC
) AS $$
  SELECT
    p.id,
    p.name,
    p.sku,
    p.type,
    p.unit,
    public.get_stock_balance(p.id) AS stock_actual,
    p.min_stock_alert
  FROM public.products p
  WHERE p.is_active = TRUE
    AND p.min_stock_alert IS NOT NULL
    AND public.get_stock_balance(p.id) <= p.min_stock_alert
    AND p.type IN ('MATERIA_PRIMA', 'INSUMO', 'ENVASE_EMPAQUE', 'PRODUCTO_A_GRANEL', 'MATERIAL_SECUNDARIO')
  ORDER BY
    (public.get_stock_balance(p.id) / NULLIF(p.min_stock_alert, 0)) ASC;
$$ LANGUAGE SQL STABLE;
