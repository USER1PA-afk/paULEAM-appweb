-- ============================================================
-- PAuleam ERP — reserve_stock unit consistency
-- ============================================================
-- The cart passes the commercial quantity (e.g. 2 lb) but
-- stock_available returns the balance in the product's
-- stock_unit (e.g. unidades, since 1 lb of cheese = 1 unidad
-- for PT-001). The previous comparison was unit-blind and
-- could either over-reserve (false rejections) or under-reserve
-- (allowing over-sell) depending on the relationship between
-- commercial and stock units.
--
-- This migration normalises p_quantity through
-- commercial_to_stock_unit() before the comparison and stores
-- the converted value in stock_reservations so the cleanup
-- cron and get_available_stock() continue to speak the same
-- language as the ledger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_user_id    UUID,
  p_product_id UUID,
  p_quantity   NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty_in_stock  NUMERIC;
  v_available     NUMERIC;
  v_reservation_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Cantidad a reservar inválida: %', p_quantity;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext(p_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto ocupado, intente de nuevo';
  END IF;

  v_qty_in_stock := public.commercial_to_stock_unit(p_quantity, p_product_id);

  v_available := public.get_available_stock(p_product_id);

  IF v_available < v_qty_in_stock THEN
    RAISE EXCEPTION
      'Stock insuficiente. Disponible: %, Solicitado: % (comercial: %)',
      v_available, v_qty_in_stock, p_quantity;
  END IF;

  INSERT INTO public.stock_reservations (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, v_qty_in_stock)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;
