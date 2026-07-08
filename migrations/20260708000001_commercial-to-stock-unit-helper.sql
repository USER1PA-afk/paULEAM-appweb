-- ============================================================
-- PAuleam ERP — Canonical helper: commercial → stock_unit qty
-- ============================================================
-- Centralises the unit conversion that the POS and e-commerce
-- flows were doing inline with `quantity / conversion_factor`,
-- which silently broke when sales_unit_name was not a known
-- unit (e.g. "Unidad" or "Libra") or when product.unit was not
-- "kg".  The helper picks the right path:
--   1. If sales unit equals stock unit, return as-is.
--   2. If both units are recognised by convert_unit, use it.
--   3. Otherwise fall back to the product's conversion_factor
--      (commercial units per 1 stock_unit).
-- ============================================================

CREATE OR REPLACE FUNCTION public.commercial_to_stock_unit(
  p_qty_commercial NUMERIC,
  p_product_id     UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_product      products%ROWTYPE;
  v_sales_unit   TEXT;
  v_stock_unit   TEXT;
  v_via_convert  NUMERIC;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
  END IF;

  v_stock_unit := COALESCE(NULLIF(TRIM(v_product.unit), ''), 'kg');
  v_sales_unit := COALESCE(NULLIF(TRIM(v_product.sales_unit_name), ''), v_stock_unit);

  IF LOWER(v_sales_unit) = LOWER(v_stock_unit) THEN
    RETURN ROUND(p_qty_commercial, 4);
  END IF;

  v_via_convert := public.convert_unit(p_qty_commercial, v_sales_unit, v_stock_unit);
  IF v_via_convert IS DISTINCT FROM p_qty_commercial
     OR LOWER(v_sales_unit) IN ('g','kg','lb','oz','ml','lt','gal') THEN
    RETURN ROUND(v_via_convert, 4);
  END IF;

  IF v_product.conversion_factor IS NOT NULL AND v_product.conversion_factor > 0 THEN
    RETURN ROUND(p_qty_commercial / v_product.conversion_factor, 4);
  END IF;

  RETURN ROUND(p_qty_commercial, 4);
END;
$$;

GRANT EXECUTE ON FUNCTION public.commercial_to_stock_unit(NUMERIC, UUID) TO authenticated;
