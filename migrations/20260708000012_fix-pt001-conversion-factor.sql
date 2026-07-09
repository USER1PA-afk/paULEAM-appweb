-- ============================================================
-- PAuleam ERP — Fix PT-001 Manaba Cheese conversion_factor
-- ============================================================
-- PRODUCT CONFIG (as reported by admin):
--   products.unit           = 'Units'    (each cheese, stored by piece)
--   products.sales_unit_name = 'Libra'   (sold by the pound)
--   products.weight (kg)    = 0.4536     (one cheese weighs 1 lb)
--   products.conversion_factor was 2.20462 — WRONG (inherited from
--   pastel de chocolate whose stock is in kg, not units).
--
-- CORRECT semantics of conversion_factor:
--   "commercial units per 1 stock unit"
--   → 1 lb of cheese is exactly 1 unit of cheese, so the factor
--   must be 1.0, not 2.20462.
--
-- WHY THIS IS THE ROOT CAUSE OF THE -7 NEGATIVE STOCK:
--   The old factor 2.20462 made process_kiosk_sale compute:
--     v_qty_physical = 1 lb / 2.20462 = 0.4536
--   and insert that 0.4536 as an EGRESO into a ledger tracked in
--   "Units". Each sale subtracted ~0.45 of a unit, so 14 sales
--   would undercount the deduction by ~6.3, drifting negative.
--   With factor = 1.0, each lb sale correctly subtracts 1 unit.
--
-- This migration is a one-time data fix. It does NOT touch the
-- schema or the guard trigger — those are already in place.
-- ============================================================

UPDATE public.products
SET conversion_factor = 1.0
WHERE sku = 'PT-001'
  AND unit IN ('Units', 'Unidades', 'unidad', 'unidades', 'Pieza', 'Pzas', 'U', 'Ud', 'Uds')
  AND sales_unit_name IN ('Libra', 'Libras', 'lb', 'lbs')
  AND ABS(conversion_factor - 1.0) > 0.0001;

-- Self-audit: log the result via RAISE so the run is visible
DO $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT sku, name, unit, sales_unit_name, conversion_factor
  INTO v_row
  FROM public.products
  WHERE sku = 'PT-001';

  IF v_row.conversion_factor IS DISTINCT FROM 1.0 THEN
    RAISE WARNING 'PT-001 conversion_factor = % (expected 1.0). '
      'Check that the product really has unit = ''Units'' and '
      'sales_unit_name = ''Libra''. Current values: unit=%, sales_unit_name=%.',
      v_row.conversion_factor, v_row.unit, v_row.sales_unit_name;
  ELSE
    RAISE NOTICE 'PT-001 conversion_factor normalised to 1.0 (unit=%, sales_unit_name=%)',
      v_row.unit, v_row.sales_unit_name;
  END IF;
END;
$$;
