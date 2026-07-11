-- ============================================================
-- PAuleam ERP — process_kiosk_sale unit consistency
-- ============================================================
-- The previous implementation computed
--   v_qty_physical := qty_commercial / v_conversion
-- where v_conversion was the conversion_factor passed from the
-- client. The result was always a "kg" value and was inserted
-- into the ledger without checking whether the product's
-- stock_unit was actually kg. This produced the original -7
-- bug for PT-001 (unit = Units, sales = Libra, factor = 2.20462
-- — the formula under-counted by ~0.55 per sale).
--
-- This migration replaces the inline division with
-- commercial_to_stock_unit(), which:
--   1. Returns qty as-is when sales_unit == stock_unit.
--   2. Uses convert_unit() when both units are recognised.
--   3. Falls back to qty / conversion_factor otherwise.
-- The client-supplied conversion_factor is now IGNORED (kept
-- in the parameter list only to avoid breaking the RPC
-- signature; callers should pass 0 or 1).
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_kiosk_sale(
  p_operator_id    UUID,
  p_customer_id    UUID,
  p_payment_method TEXT,
  p_items          JSONB,
  p_total          NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id        UUID;
  v_item            JSONB;
  v_product_id      UUID;
  v_qty_commercial  NUMERIC;
  v_unit_price      NUMERIC;
  v_qty_in_stock    NUMERIC;
  v_available       NUMERIC;
BEGIN
  IF p_payment_method NOT IN ('EFECTIVO', 'QR_DEUNA') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
  END IF;

  INSERT INTO public.orders (
    user_id, status, total, sale_origin, payment_method, notes
  )
  VALUES (
    p_customer_id,
    'COMPLETADO',
    p_total,
    'KIOSK',
    p_payment_method,
    'Venta kiosko. Operador: ' || p_operator_id::TEXT
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id     := (v_item->>'product_id')::UUID;
    v_qty_commercial := (v_item->>'qty_commercial')::NUMERIC;
    v_unit_price     := (v_item->>'unit_price')::NUMERIC;

    -- Canonical unit conversion. Ignore client-supplied
    -- conversion_factor — the helper derives the right value
    -- from the product row (unit, sales_unit_name, factor).
    v_qty_in_stock := public.commercial_to_stock_unit(
      v_qty_commercial, v_product_id
    );

    IF NOT pg_try_advisory_xact_lock(hashtext(v_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Producto % ocupado, intente de nuevo', v_product_id;
    END IF;

    v_available := public.get_stock_balance(v_product_id);

    IF v_available < v_qty_in_stock THEN
      RAISE EXCEPTION
        'Stock insuficiente para producto %. Disponible: %, Requerido: %',
        v_product_id, v_available, v_qty_in_stock;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, subtotal
    )
    VALUES (
      v_order_id, v_product_id,
      v_qty_commercial,
      v_unit_price,
      ROUND(v_qty_commercial * v_unit_price, 2)
    );

    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    )
    VALUES (
      v_product_id,
      'EGRESO',
      v_qty_in_stock,
      v_unit_price,
      'VENTA',
      v_order_id,
      'Venta kiosko #' || SUBSTRING(v_order_id::TEXT, 1, 8),
      p_operator_id
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;
