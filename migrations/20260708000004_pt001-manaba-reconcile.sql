-- ============================================================
-- PAuleam ERP — PT-001 Manaba Cheese ledger reconciliation
-- ============================================================
-- HOW TO USE:
--   1. Do a physical count of Manaba Cheese on the shelf.
--   2. Replace :physical_count below with that real number.
--   3. Run the script in the Insforge SQL console.
--
-- The script inserts a single compensating AJUSTE movement
-- (reference_type = 'INVENTARIO_FISICO') that brings
-- get_stock_balance() to the real physical count. After this
-- runs, stock_summary will show the correct number and the
-- new guard trigger (migration 20260708000000) will keep it
-- from drifting negative again.
--
-- Verify the negative value with the SELECT first; if it has
-- already been corrected externally, abort before running the
-- UPDATE.
-- ============================================================

DO $$
DECLARE
  v_product_id   UUID;
  v_physical     NUMERIC := 0;
  v_current      NUMERIC;
  v_delta        NUMERIC;
  v_user_id      UUID;
BEGIN
  SELECT id INTO v_product_id
  FROM public.products WHERE sku = 'PT-001';

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'PT-001 no encontrado';
  END IF;

  v_current := public.get_stock_balance(v_product_id);

  IF v_current >= 0 THEN
    RAISE NOTICE 'PT-001 ya está en positivo (%). Nada que reconciliar.', v_current;
    RETURN;
  END IF;

  v_user_id := auth.uid();

  v_delta := v_physical - v_current;

  IF v_delta = 0 THEN
    RAISE NOTICE 'PT-001 ya coincide con conteo físico (%).', v_current;
    RETURN;
  END IF;

  IF v_delta > 0 THEN
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_product_id,
      'INGRESO',
      v_delta,
      0,
      'AJUSTE',
      gen_random_uuid(),
      FORMAT('Conteo físico: ajuste de %s a %s (sistema %s pre-existente)', v_current, v_physical, v_current),
      v_user_id
    );
  ELSE
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_product_id,
      'EGRESO',
      -v_delta,
      0,
      'AJUSTE',
      gen_random_uuid(),
      FORMAT('Conteo físico: ajuste de %s a %s', v_current, v_physical),
      v_user_id
    );
  END IF;

  RAISE NOTICE 'PT-001 reconciliado: % → %', v_current, v_physical;
END;
$$;
