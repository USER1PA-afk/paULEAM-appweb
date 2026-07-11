-- ============================================================
-- PAuleam ERP — Inventory EGRESO guard regression test
-- (Insforge-compatible: no BEGIN/COMMIT/ROLLBACK/SAVEPOINT)
-- ============================================================
-- Run as ONE statement in the Insforge SQL console. All test
-- rows are tagged with the __TEST_ / __test prefix and deleted
-- before and after the suite, so re-runs are safe.
--
-- Scenarios:
--   1. Direct INSERT EGRESO with insufficient stock → rejected
--   2. Direct INSERT EGRESO with sufficient stock   → allowed
--   3. Direct INSERT INGRESO                         → never blocked
--   4. process_kiosk_sale over-sell                 → rejected
--   5. process_kiosk_sale valid sale                → allowed
--   6. fn_finalize_online_order over-sell           → rejected
--   7. fn_finalize_online_order valid order         → allowed
--   8. fn_packaging_completion over-capacity        → rejected
--   9. declare_production_waste over-stock          → rejected
--  10. process_production_completion over-yield     → rejected
--  11. commercial_to_stock_unit helper — 3 paths
--  12. POS unit math: 1 lb of kg-tracked cheese → 1/2.20462 kg
--  13. reserve_stock normalises commercial qty
--  14. Defense-in-depth constraints enforced
--      14a. quantity > 0
--      14b. movement_type whitelist
--      14c. reference_type whitelist
-- ============================================================

DO $$
DECLARE
  v_passed INT := 0;
  v_failed INT := 0;
  v_total  INT := 0;
  v_failures TEXT := '';

  v_pt  UUID;
  v_ing UUID;
  v_cust UUID;
  v_op  UUID;
  v_order_id UUID;
  v_status TEXT;
  v_tpl_id  UUID;
  v_po_id   UUID;
  v_recipe_id UUID;

  v_caught BOOLEAN;
  v_err    TEXT;
  v_helper_kg UUID;
BEGIN
  -- ── 0. Idempotent cleanup of any leftover test rows ─────
  -- Each DELETE is its OWN sub-block so a failure in one does
  -- not roll back the others. Strategy: delete by PRODUCT
  -- reference, not by order notes — the kiosk sale creates
  -- orders with arbitrary notes ("Venta kiosko. Operador: ...")
  -- that would otherwise leak through every where-like check.
  BEGIN DELETE FROM public.inventory_ledger
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.stock_reservations
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.order_items
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.orders
    WHERE id NOT IN (SELECT DISTINCT order_id FROM public.order_items);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipe_ingredients
    WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipe_ingredients
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.production_orders
    WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipes WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_template_materials
    WHERE material_product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_orders
    WHERE template_id IN (SELECT id FROM public.packaging_templates WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_templates WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.products WHERE sku LIKE '__TEST_%';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ── Setup: one PT (10 kg) + one ingredient (5 lt) ────────
  INSERT INTO public.products
    (sku, name, type, unit, price, is_active, conversion_factor, sales_unit_name)
  VALUES
    ('__TEST_PT_001', '__Test Cheese', 'PRODUCTO_TERMINADO', 'kg', 2.7, true, 1.0, 'Unidad')
  RETURNING id INTO v_pt;

  INSERT INTO public.products
    (sku, name, type, unit, price, is_active, conversion_factor)
  VALUES
    ('__TEST_ING_001', '__Test Milk', 'MATERIA_PRIMA', 'lt', 0.5, true, 1.0)
  RETURNING id INTO v_ing;

  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
  VALUES
    (v_pt, 'INGRESO', 10, 1.0, 'AJUSTE', gen_random_uuid(), '__test seed', auth.uid());

  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
  VALUES
    (v_ing, 'INGRESO', 5, 0.5, 'COMPRA', gen_random_uuid(), '__test seed', auth.uid());

  -- pick a real operator profile
  SELECT id INTO v_op FROM public.profiles WHERE role IN ('admin','sales_kiosk') LIMIT 1;
  IF v_op IS NULL THEN
    SELECT id INTO v_op FROM auth.users LIMIT 1;
  END IF;

  -- pick a real customer (cliente profile). profiles.id is FK to auth.users,
  -- so we must reuse an existing id — never insert a synthetic one.
  SELECT id INTO v_cust FROM public.profiles WHERE role = 'cliente' LIMIT 1;
  IF v_cust IS NULL THEN
    v_cust := v_op;
  END IF;

  -- ════════════════════════════════════════════════════════
  -- 1. Direct EGRESO over-balance → rejected
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    v_caught := FALSE; v_err := NULL;
    BEGIN
      EXECUTE format(
        'INSERT INTO public.inventory_ledger (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (%L, %L, %s, %L, gen_random_uuid(), %L, auth.uid())',
        v_pt, 'EGRESO', 999, 'VENTA', '__test over-egreso');
    EXCEPTION WHEN OTHERS THEN
      v_caught := TRUE; v_err := SQLERRM;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'T1: no exception raised';
    END IF;
    IF v_err !~* 'EGRESO rechazado|check_violation' THEN
      RAISE EXCEPTION 'T1: wrong exception: %', v_err;
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T1: direct EGRESO over-balance rejected';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T1 (direct EGRESO over-balance) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 2. Direct EGRESO within balance → allowed
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    VALUES (v_pt, 'EGRESO', 3, 'VENTA', gen_random_uuid(), '__test valid', auth.uid());
    IF public.get_stock_balance(v_pt) IS DISTINCT FROM 7 THEN
      RAISE EXCEPTION 'T2: expected 7, got %', public.get_stock_balance(v_pt);
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T2: direct EGRESO valid (balance 10→7)';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T2 (direct EGRESO valid) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 3. INGRESO not blocked
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    VALUES (v_pt, 'INGRESO', 100, 'AJUSTE', gen_random_uuid(), '__test seed+', auth.uid());
    IF public.get_stock_balance(v_pt) IS DISTINCT FROM 107 THEN
      RAISE EXCEPTION 'T3: expected 107, got %', public.get_stock_balance(v_pt);
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T3: INGRESO not blocked (balance 7→107)';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T3 (INGRESO not blocked) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 4. process_kiosk_sale over-sell
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    v_caught := FALSE; v_err := NULL;
    BEGIN
      PERFORM public.process_kiosk_sale(
        v_op, v_cust, 'EFECTIVO',
        jsonb_build_array(jsonb_build_object(
          'product_id', v_pt, 'qty_commercial', 999,
          'unit_price', 2.7, 'conversion_factor', 1.0
        )),
        2699.3
      );
    EXCEPTION WHEN OTHERS THEN
      v_caught := TRUE; v_err := SQLERRM;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'T4: no exception raised';
    END IF;
    IF v_err !~* 'Stock insuficiente|check_violation|EGRESO rechazado' THEN
      RAISE EXCEPTION 'T4: wrong exception: %', v_err;
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T4: kiosk over-sell rejected';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T4 (kiosk over-sell) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 5. process_kiosk_sale valid
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    SELECT public.process_kiosk_sale(
      v_op, v_cust, 'EFECTIVO',
      jsonb_build_array(jsonb_build_object(
        'product_id', v_pt, 'qty_commercial', 2,
        'unit_price', 2.7, 'conversion_factor', 1.0
      )),
      5.4
    ) INTO v_order_id;
    IF v_order_id IS NULL THEN
      RAISE EXCEPTION 'T5: no order id returned';
    END IF;
    IF public.get_stock_balance(v_pt) IS DISTINCT FROM 105 THEN
      RAISE EXCEPTION 'T5: expected 105, got %', public.get_stock_balance(v_pt);
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T5: kiosk valid (balance 107→105)';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T5 (kiosk valid) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 6. fn_finalize_online_order over-sell
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.orders (user_id, status, total, sale_origin, payment_method, notes, fulfillment_type)
    VALUES (v_cust, 'PAGADO', 2699.30, 'ECOMMERCE', 'TRANSFERENCIA', '__test over', 'ENVIO')
    RETURNING id INTO v_order_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_pt, 999, 2.7, 2699.30);

    v_caught := FALSE; v_err := NULL;
    BEGIN
      PERFORM public.fn_finalize_online_order(v_order_id, 'APROBADO');
    EXCEPTION WHEN OTHERS THEN
      v_caught := TRUE; v_err := SQLERRM;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'T6: no exception raised';
    END IF;
    IF v_err !~* 'EGRESO rechazado|Stock insuficiente|check_violation' THEN
      RAISE EXCEPTION 'T6: wrong exception: %', v_err;
    END IF;
    SELECT status INTO v_status FROM public.orders WHERE id = v_order_id;
    IF v_status IS DISTINCT FROM 'PAGADO' THEN
      RAISE EXCEPTION 'T6: order status changed to % despite failure', v_status;
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T6: online over-sell rejected, order still PAGADO';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T6 (online over-sell) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 7. fn_finalize_online_order valid
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.orders (user_id, status, total, sale_origin, payment_method, notes, fulfillment_type)
    VALUES (v_cust, 'PAGADO', 5.40, 'ECOMMERCE', 'TRANSFERENCIA', '__test ok', 'ENVIO')
    RETURNING id INTO v_order_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_pt, 2, 2.7, 5.40);
    PERFORM public.fn_finalize_online_order(v_order_id, 'APROBADO');
    SELECT status INTO v_status FROM public.orders WHERE id = v_order_id;
    IF v_status IS DISTINCT FROM 'APROBADO' THEN
      RAISE EXCEPTION 'T7: order status = %', v_status;
    END IF;
    IF public.get_stock_balance(v_pt) IS DISTINCT FROM 103 THEN
      RAISE EXCEPTION 'T7: expected 103, got %', public.get_stock_balance(v_pt);
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T7: online valid (balance 105→103)';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T7 (online valid) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 8. fn_packaging_completion over-capacity
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.packaging_templates
      (name, finished_product_id, output_product_id, bulk_qty_per_unit, bulk_unit, output_unit)
    VALUES
      ('__test tpl', v_pt, v_pt, 1.0, 'kg', 'kg')
    RETURNING id INTO v_tpl_id;
    INSERT INTO public.packaging_orders
      (template_id, status, units_to_package, created_by)
    VALUES
      (v_tpl_id, 'EN_PROCESO', 999, v_op)
    RETURNING id INTO v_po_id;
    UPDATE public.packaging_orders SET status = 'COMPLETADA' WHERE id = v_po_id;
    RAISE EXCEPTION 'T8: packaging over-capacity was NOT rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* 'Stock insuficiente|EGRESO rechazado|check_violation' THEN
      v_passed := v_passed + 1;
      RAISE NOTICE '  PASS T8: packaging over-capacity rejected';
    ELSIF SQLERRM ~* 'T8: packaging over-capacity was NOT rejected' THEN
      v_failed := v_failed + 1;
      v_failures := v_failures || E'\n  • T8 (packaging over-capacity) — guard did not fire';
    ELSE
      v_failed := v_failed + 1;
      v_failures := v_failures || E'\n  • T8 (packaging over-capacity) — ' || SQLERRM;
    END IF;
  END;

  -- ════════════════════════════════════════════════════════
  -- 9. declare_production_waste over-stock
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.recipes (name, output_product_id, yield_base, yield_unit)
    VALUES ('__test recipe waste', v_pt, 1.0, 'kg')
    RETURNING id INTO v_recipe_id;
    INSERT INTO public.production_orders
      (recipe_id, target_yield, status, batch_number, created_by)
    VALUES (v_recipe_id, 1.0, 'COMPLETADA', '__TEST_BATCH_W', v_op)
    RETURNING id INTO v_order_id;

    v_caught := FALSE; v_err := NULL;
    BEGIN
      PERFORM public.declare_production_waste(v_order_id, 99999, '__test waste');
    EXCEPTION WHEN OTHERS THEN
      v_caught := TRUE; v_err := SQLERRM;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'T9: no exception raised';
    END IF;
    IF v_err !~* 'Stock insuficiente|EGRESO rechazado|check_violation' THEN
      RAISE EXCEPTION 'T9: wrong exception: %', v_err;
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T9: declare_waste over-stock rejected';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T9 (declare_waste over-stock) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 10. process_production_completion over-yield
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    INSERT INTO public.recipes (name, output_product_id, yield_base, yield_unit)
    VALUES ('__test recipe prod', v_pt, 1.0, 'kg')
    RETURNING id INTO v_recipe_id;
    INSERT INTO public.recipe_ingredients (recipe_id, product_id, quantity, unit)
    VALUES (v_recipe_id, v_ing, 3, 'lt');
    INSERT INTO public.production_orders
      (recipe_id, target_yield, status, batch_number, created_by)
    VALUES (v_recipe_id, 10.0, 'EN_PROCESO', NULL, v_op)
    RETURNING id INTO v_order_id;
    UPDATE public.production_orders SET status = 'COMPLETADA' WHERE id = v_order_id;
    RAISE EXCEPTION 'T10: production over-yield was NOT rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* 'Stock insuficiente|EGRESO rechazado|check_violation' THEN
      v_passed := v_passed + 1;
      RAISE NOTICE '  PASS T10: production over-yield rejected';
    ELSIF SQLERRM ~* 'T10: production over-yield was NOT rejected' THEN
      v_failed := v_failed + 1;
      v_failures := v_failures || E'\n  • T10 (production over-yield) — guard did not fire';
    ELSE
      v_failed := v_failed + 1;
      v_failures := v_failures || E'\n  • T10 (production over-yield) — ' || SQLERRM;
    END IF;
  END;

  -- ════════════════════════════════════════════════════════
  -- 11. commercial_to_stock_unit helper — 3 paths
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    -- Path 1: units match → identity (kg ↔ kg)
    INSERT INTO public.products
      (sku, name, type, unit, price, is_active, conversion_factor, sales_unit_name)
    VALUES
      ('__TEST_HELPER_P1', '__Test Helper P1', 'PRODUCTO_TERMINADO', 'kg', 1.0, true, 1.0, 'kg')
    RETURNING id INTO v_helper_kg;
    IF public.commercial_to_stock_unit(5, v_helper_kg) IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'T11 P1: expected 5, got %', public.commercial_to_stock_unit(5, v_helper_kg);
    END IF;

    -- Path 2: convert_unit known (g → kg)
    INSERT INTO public.products
      (sku, name, type, unit, price, is_active, conversion_factor, sales_unit_name)
    VALUES
      ('__TEST_HELPER_P2', '__Test Helper P2', 'PRODUCTO_TERMINADO', 'kg', 1.0, true, 1.0, 'g')
    RETURNING id INTO v_helper_kg;
    IF public.commercial_to_stock_unit(1000, v_helper_kg) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'T11 P2: 1000g → kg, expected 1, got %', public.commercial_to_stock_unit(1000, v_helper_kg);
    END IF;

    -- Path 3: fallback to conversion_factor (Unidad unknown to convert_unit)
    -- __TEST_PT_001: unit=kg, sales=Unidad, factor=1.0 → 4/1.0 = 4
    IF public.commercial_to_stock_unit(4, v_pt) IS DISTINCT FROM 4 THEN
      RAISE EXCEPTION 'T11 P3: 4 unidades / factor 1.0, expected 4, got %', public.commercial_to_stock_unit(4, v_pt);
    END IF;
    v_passed := v_passed + 1;
    RAISE NOTICE '  PASS T11: helper 3 paths';
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T11 (helper 3 paths) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 12. POS unit math: 1 lb sold → ledger gets 1/2.20462 kg
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    DECLARE
      v_cheese UUID;
      v_expected_kg NUMERIC := ROUND(1.0 / 2.20462, 4);
      v_actual_egreso NUMERIC;
      v_new_order UUID;
    BEGIN
      INSERT INTO public.products
        (sku, name, type, unit, price, is_active, conversion_factor, sales_unit_name)
      VALUES
        ('__TEST_LB_001', '__Test Libranche', 'PRODUCTO_TERMINADO', 'kg', 2.7, true, 2.20462, 'Libra')
      RETURNING id INTO v_cheese;

      INSERT INTO public.inventory_ledger
        (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
      VALUES
        (v_cheese, 'INGRESO', 5, 1.0, 'AJUSTE', gen_random_uuid(), '__test seed', auth.uid());

      SELECT public.process_kiosk_sale(
        v_op, v_cust, 'EFECTIVO',
        jsonb_build_array(jsonb_build_object(
          'product_id', v_cheese, 'qty_commercial', 1,
          'unit_price', 2.7, 'conversion_factor', 2.20462
        )),
        2.7
      ) INTO v_new_order;

      SELECT quantity INTO v_actual_egreso
      FROM public.inventory_ledger
      WHERE product_id = v_cheese
        AND movement_type = 'EGRESO'
        AND reference_id = v_new_order;

      IF v_actual_egreso IS DISTINCT FROM v_expected_kg THEN
        RAISE EXCEPTION
          'T12: 1 lb sold, expected % kg in ledger, got %',
          v_expected_kg, v_actual_egreso;
      END IF;
      v_passed := v_passed + 1;
      RAISE NOTICE '  PASS T12: POS unit math (1 lb → % kg)', v_expected_kg;
    END;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T12 (POS unit math) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 13. reserve_stock normalises commercial qty
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    DECLARE
      v_cheese UUID;
      v_res_id UUID;
      v_res_qty NUMERIC;
    BEGIN
      SELECT id INTO v_cheese FROM public.products WHERE sku = '__TEST_LB_001';

      -- 2 lb sold → reservation should be 2/2.20462 = 0.9072 kg
      SELECT public.reserve_stock(v_cust, v_cheese, 2) INTO v_res_id;

      SELECT quantity INTO v_res_qty
      FROM public.stock_reservations WHERE id = v_res_id;

      IF v_res_qty IS DISTINCT FROM ROUND(2.0 / 2.20462, 4) THEN
        RAISE EXCEPTION
          'T13: reserve 2 lb, expected % kg, got %',
          ROUND(2.0 / 2.20462, 4), v_res_qty;
      END IF;

      -- 100 lb → insufficient stock (only ~4.09 kg left)
      v_caught := FALSE; v_err := NULL;
      BEGIN
        PERFORM public.reserve_stock(v_cust, v_cheese, 100);
      EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE; v_err := SQLERRM;
      END;
      IF NOT v_caught THEN
        RAISE EXCEPTION 'T13: over-reserve was not rejected';
      END IF;
      IF v_err !~* 'Stock insuficiente' THEN
        RAISE EXCEPTION 'T13: wrong exception: %', v_err;
      END IF;

      v_passed := v_passed + 1;
      RAISE NOTICE '  PASS T13: reserve_stock normalises (2 lb → % kg)', ROUND(2.0 / 2.20462, 4);
    END;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T13 (reserve_stock unit) — ' || SQLERRM;
  END;

  -- ════════════════════════════════════════════════════════
  -- 14. Defense-in-depth constraints enforced
  -- ════════════════════════════════════════════════════════
  BEGIN
    v_total := v_total + 1;
    DECLARE
      v_pt_any UUID;
    BEGIN
      SELECT id INTO v_pt_any FROM public.products WHERE sku = '__TEST_PT_001';

      -- 14a: zero quantity rejected (CHECK on quantity > 0)
      v_caught := FALSE; v_err := NULL;
      BEGIN
        INSERT INTO public.inventory_ledger
          (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        VALUES (v_pt_any, 'EGRESO', 0, 'VENTA', gen_random_uuid(), '__test zero', auth.uid());
      EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE; v_err := SQLERRM;
      END;
      IF NOT v_caught THEN
        RAISE EXCEPTION 'T14a: zero quantity not rejected — no exception raised';
      END IF;
      IF v_err !~* 'check constraint|check_violation' THEN
        RAISE EXCEPTION 'T14a: zero quantity rejected but not by CHECK (err: %)', v_err;
      END IF;

      -- 14b: invalid movement_type rejected (handled by the public.movement_type
      -- ENUM type; our CHECK is defense-in-depth and the error message may
      -- be either "check constraint" or "invalid input value for enum").
      v_caught := FALSE; v_err := NULL;
      BEGIN
        INSERT INTO public.inventory_ledger
          (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        VALUES (v_pt_any, 'FOO', 1, 'VENTA', gen_random_uuid(), '__test bad', auth.uid());
      EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE; v_err := SQLERRM;
      END;
      IF NOT v_caught THEN
        RAISE EXCEPTION 'T14b: invalid movement_type not rejected — row was inserted. Expected rejection by ENUM cast or CHECK constraint.';
      END IF;
      IF v_err !~* 'check constraint|check_violation|invalid input value for enum' THEN
        RAISE EXCEPTION 'T14b: movement_type rejected but with unexpected error: %', v_err;
      END IF;

      -- 14c: invalid reference_type rejected (CHECK on reference_type whitelist)
      -- Use the MATERIA_PRIMA test ingredient (v_ing) to bypass the
      -- PRODUCTO_TERMINADO INGRESO trigger, which would otherwise
      -- catch 'PIRATE' with its own product-type whitelist first.
      v_caught := FALSE; v_err := NULL;
      BEGIN
        INSERT INTO public.inventory_ledger
          (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        VALUES (v_ing, 'INGRESO', 1, 'PIRATE', gen_random_uuid(), '__test bad', auth.uid());
      EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE; v_err := SQLERRM;
      END;
      IF NOT v_caught THEN
        RAISE EXCEPTION 'T14c: invalid reference_type not rejected — no exception raised';
      END IF;
      IF v_err !~* 'check constraint|check_violation' THEN
        RAISE EXCEPTION 'T14c: reference_type rejected but not by CHECK (err: %)', v_err;
      END IF;

      v_passed := v_passed + 1;
      RAISE NOTICE '  PASS T14: defense-in-depth constraints enforced';
    END;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1;
    v_failures := v_failures || E'\n  • T14 (constraints) — ' || SQLERRM;
  END;

  -- ── Final cleanup ────────────────────────────────────────
  BEGIN DELETE FROM public.inventory_ledger
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.stock_reservations
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.order_items
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.orders
    WHERE id NOT IN (SELECT DISTINCT order_id FROM public.order_items);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipe_ingredients
    WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipe_ingredients
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.production_orders
    WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.recipes WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_template_materials
    WHERE material_product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_orders
    WHERE template_id IN (SELECT id FROM public.packaging_templates WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.packaging_templates WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.products WHERE sku LIKE '__TEST_%';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ── Verify: nothing should remain ───────────────────────
  DECLARE
    v_leftover INT;
  BEGIN
    SELECT COUNT(*) INTO v_leftover
    FROM public.products WHERE sku LIKE '__TEST_%';
    IF v_leftover > 0 THEN
      RAISE EXCEPTION 'Cleanup incomplete: % test products still present', v_leftover;
    END IF;
    SELECT COUNT(*) INTO v_leftover
    FROM public.inventory_ledger
    WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
    IF v_leftover > 0 THEN
      RAISE EXCEPTION 'Cleanup incomplete: % test ledger rows still present', v_leftover;
    END IF;
  END;

  -- Always raise at the end so the result is visible in the
  -- console (which suppresses intermediate RAISE NOTICE).
  IF v_failed > 0 THEN
    RAISE EXCEPTION
      'Regression suite FAILED — %/% passed, % failure(s):%s',
      v_passed, v_total, v_failed, v_failures;
  ELSE
    RAISE EXCEPTION
      'Regression suite PASSED — %/% tests (0 failed).',
      v_passed, v_total;
  END IF;
END;
$$;
