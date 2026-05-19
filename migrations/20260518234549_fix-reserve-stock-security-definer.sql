-- ============================================================
-- PAuleam ERP — Fix: SECURITY DEFINER en funciones de Stock
-- ============================================================
-- Se marcan como SECURITY DEFINER para que puedan leer de inventory_ledger
-- (que tiene RLS restrictivo para usuarios tipo 'cliente') y se establece
-- search_path = public por seguridad.

CREATE OR REPLACE FUNCTION public.get_stock_balance(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(
      CASE
        WHEN movement_type = 'INGRESO' THEN quantity
        WHEN movement_type = 'EGRESO' THEN -quantity
      END
    )
    FROM public.inventory_ledger
    WHERE product_id = p_product_id), 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_stock(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_stock_balance(p_product_id)
    - COALESCE(
        (SELECT SUM(quantity)
         FROM public.stock_reservations
         WHERE product_id = p_product_id
           AND expires_at > now()),
        0
      );
END;
$$;

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
  v_available  NUMERIC;
  v_reservation_id UUID;
BEGIN
  -- Bloqueo consultivo por producto para evitar race conditions
  IF NOT pg_try_advisory_xact_lock(hashtext(p_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto ocupado, intente de nuevo';
  END IF;

  -- Verificar stock disponible
  v_available := public.get_available_stock(p_product_id);

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_available, p_quantity;
  END IF;

  -- Crear reserva (expira en 15 minutos)
  INSERT INTO public.stock_reservations (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, p_quantity)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;
