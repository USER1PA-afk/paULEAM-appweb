-- ============================================================
-- PAuleam ERP — fn_finalize_online_order: atomic e-commerce EGRESO
-- ============================================================
-- The previous e-commerce path inserted EGRESOs from the
-- checkout/hooks layer (approveOrder for ENVIO, confirmPickup for
-- RETIRO_EN_PLANTA) without any stock check, and used
-- quantity / conversion_factor (always kg) which broke products
-- tracked in non-kg units. This RPC is the only safe way to
-- finalise an online order. It:
--   1. Locks the order row FOR UPDATE.
--   2. Validates status (PAGADO or APROBADO → APROBADO/COMPLETADO).
--   3. Computes the EGRESO per item via commercial_to_stock_unit().
--   4. Relies on trg_guard_inventory_ledger_egreso (migration
--      20260708000000) to reject the transaction atomically if
--      any line item is short — partial writes are impossible.
--   5. Updates orders.status and orders.approved_at.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_finalize_online_order(
  p_order_id   UUID,
  p_target_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order          RECORD;
  v_item           RECORD;
  v_physical_qty   NUMERIC;
  v_status         TEXT;
BEGIN
  IF p_target_status NOT IN ('APROBADO', 'COMPLETADO') THEN
    RAISE EXCEPTION 'Estado destino inválido: %', p_target_status;
  END IF;

  SELECT id, status, user_id, approved_by
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  v_status := CASE
    WHEN p_target_status = 'APROBADO'   AND v_order.status = 'PAGADO'    THEN 'APROBADO'
    WHEN p_target_status = 'COMPLETADO' AND v_order.status IN ('APROBADO','PAGADO') THEN 'COMPLETADO'
    ELSE NULL
  END;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Transición de estado inválida: % → %', v_order.status, p_target_status;
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    v_physical_qty := public.commercial_to_stock_unit(v_item.quantity, v_item.product_id);

    IF v_physical_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida (%) para producto %', v_physical_qty, v_item.product_id;
    END IF;

    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_item.product_id,
      'EGRESO',
      v_physical_qty,
      0,
      'VENTA',
      p_order_id,
      FORMAT('Venta online #%s — %s',
        SUBSTRING(p_order_id::TEXT, 1, 8),
        CASE WHEN v_status = 'APROBADO' THEN 'ENVIO' ELSE 'RETIRO_EN_PLANTA' END),
      auth.uid()
    );
  END LOOP;

  IF v_status = 'APROBADO' THEN
    UPDATE public.orders
    SET status = 'APROBADO',
        approved_by = COALESCE(approved_by, auth.uid()),
        approved_at = COALESCE(approved_at, now()),
        updated_at = now()
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders
    SET status = 'COMPLETADO',
        updated_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_finalize_online_order(UUID, TEXT) TO authenticated;
