-- ============================================================
-- PAuleam ERP — Audit query: products with possibly bad
-- conversion_factor
-- ============================================================
-- Run this in the Insforge SQL console to find any other product
-- whose conversion_factor doesn't match the relationship between
-- its stock unit and commercial unit. Read the rows; if any look
-- wrong, copy the correct factor from the explanation column
-- and update manually.
--
-- "Suspect" criteria:
--   * unit is a per-piece unit AND sales_unit_name is a weight
--     unit AND conversion_factor != 1.0
--     (e.g. 1 unit of cheese sold as 1 lb → factor should be 1)
--   * unit is a weight unit AND sales_unit_name is the same
--     weight unit AND conversion_factor != 1.0
--   * unit is a weight unit AND sales_unit_name is a different
--     weight unit AND conversion_factor is way off
-- ============================================================

WITH unit_classes AS (
  SELECT
    p.sku, p.name,
    p.unit, p.sales_unit_name, p.conversion_factor, p.weight,
    CASE
      WHEN LOWER(p.unit) IN ('kg','g','lb','oz','lt','ml','gal') THEN 'mass_volume'
      ELSE 'piece'
    END AS stock_class,
    CASE
      WHEN LOWER(COALESCE(p.sales_unit_name, p.unit)) IN ('kg','g','lb','oz','lt','ml','gal') THEN 'mass_volume'
      ELSE 'piece'
    END AS sales_class
  FROM public.products p
  WHERE p.is_active = TRUE
)
SELECT
  sku, name, unit, sales_unit_name, conversion_factor, weight,
  stock_class, sales_class,
  CASE
    WHEN stock_class = sales_class AND conversion_factor <> 1.0
      THEN 'SUSPECT: same class, factor should be 1.0'
    WHEN stock_class = 'piece' AND sales_class = 'mass_volume' AND conversion_factor <> 1.0
      THEN 'SUSPECT: piece sold by mass, factor should be 1.0 (1 lb = 1 piece if each piece weighs 1 lb)'
    WHEN stock_class = 'mass_volume' AND sales_class = 'piece' AND conversion_factor <> 1.0
      THEN 'SUSPECT: mass sold by piece, factor should match kg-per-piece'
    ELSE 'OK'
  END AS diagnosis
FROM unit_classes
ORDER BY diagnosis DESC, sku;
