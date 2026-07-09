-- ============================================================
-- PAuleam ERP — WAC recompute for products where
-- recipes.yield_unit ≠ products.unit
-- ============================================================
-- Before migration 002, the production trigger inserted the
-- finished-product INGRESO with quantity = v_effective_yield
-- (in the recipe's yield_unit) and unit_cost computed as
-- v_total_cost / v_effective_yield (cost per yield_unit).
-- The WAC was therefore stored in yield_unit terms.
--
-- After 002, new productions store quantity and unit_cost in
-- the product's stock_unit. cost_per_unit values from before
-- that change are now in the wrong unit and need to be
-- normalised:
--
--   new_cost_per_unit = old_cost_per_unit / convert_unit(1, yield_unit, stock_unit)
--
-- For PT-001 Manaba Cheese:
--   yield_unit = "Unidad", stock_unit = "Units" (1:1) → no change
--   But e.g. pastel de chocolate: yield_unit = "kg", stock_unit = "kg" → no change
--   Hypothetical yield_unit = "Unidad" + stock_unit = "kg" with 1 U = 0.5 kg
--     old $2/U → new $2 / 0.5 = $4/kg
--
-- The migration is idempotent and logs every change.
-- After it runs, re-run the production trigger for any
-- in-flight orders so their WAC re-derives cleanly.
-- ============================================================

DO $$
DECLARE
  r            RECORD;
  v_yield_unit TEXT;
  v_factor     NUMERIC;
  v_new_cost   NUMERIC;
  v_changed    INT := 0;
  v_skipped    INT := 0;
BEGIN
  FOR r IN
    SELECT
      p.id           AS product_id,
      p.sku,
      p.name,
      p.unit         AS stock_unit,
      p.cost_per_unit AS old_cost,
      ARRAY_AGG(DISTINCT rec.yield_unit) AS yield_units
    FROM public.products p
    JOIN public.recipes rec ON rec.output_product_id = p.id
    WHERE p.cost_per_unit IS NOT NULL
      AND p.cost_per_unit > 0
    GROUP BY p.id, p.sku, p.name, p.unit, p.cost_per_unit
  LOOP
    IF array_length(r.yield_units, 1) > 1 THEN
      RAISE WARNING
        'Product % (%) has multiple recipe yield_units: %. Using first: %.',
        r.sku, r.product_id, r.yield_units, r.yield_units[1];
    END IF;

    v_yield_unit := r.yield_units[1];

    IF LOWER(TRIM(v_yield_unit)) = LOWER(TRIM(r.stock_unit)) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_factor := public.convert_unit(1, v_yield_unit, r.stock_unit);

    IF v_factor IS NULL OR v_factor = 0 THEN
      RAISE WARNING
        'Product %: cannot convert 1 % to % (convert_unit returned 0/NULL). Skipping.',
        r.sku, v_yield_unit, r.stock_unit;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_new_cost := ROUND(r.old_cost / v_factor, 4);

    IF v_new_cost IS DISTINCT FROM r.old_cost THEN
      UPDATE public.products
      SET cost_per_unit = v_new_cost
      WHERE id = r.product_id;

      v_changed := v_changed + 1;
      RAISE NOTICE
        'WAC recompute: % (%): % per % → % per % (factor: %)',
        r.sku, r.name,
        r.old_cost, v_yield_unit,
        v_new_cost, r.stock_unit,
        v_factor;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'WAC recompute complete: % changed, % unchanged/skipped', v_changed, v_skipped;
END;
$$;
