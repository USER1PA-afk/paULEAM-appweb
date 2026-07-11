CREATE OR REPLACE FUNCTION public.enforce_finished_product_ingress()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  IF NEW.movement_type = 'INGRESO' THEN
    SELECT type INTO v_type
    FROM public.products
    WHERE id = NEW.product_id;

    IF v_type = 'PRODUCTO_A_GRANEL'
       AND NEW.reference_type NOT IN ('PRODUCCION', 'AJUSTE') THEN
      RAISE EXCEPTION
        'Un PRODUCTO_A_GRANEL solo puede recibir INGRESO por PRODUCCION o AJUSTE. Se recibió: %',
        NEW.reference_type;
    END IF;

    IF v_type = 'PRODUCTO_TERMINADO'
       AND NEW.reference_type NOT IN ('PRODUCCION', 'EMPAQUE', 'AJUSTE') THEN
      RAISE EXCEPTION
        'Un PRODUCTO_TERMINADO solo puede recibir INGRESO por PRODUCCION, EMPAQUE o AJUSTE. Se recibió: %',
        NEW.reference_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_low_stock_products()
RETURNS TABLE (
  product_id   UUID,
  product_name TEXT,
  product_sku  TEXT,
  product_type public.product_type,
  unit         TEXT,
  stock_actual NUMERIC,
  min_stock    NUMERIC
) AS $$
  SELECT
    p.id,
    p.name,
    p.sku,
    p.type,
    p.unit,
    public.get_stock_balance(p.id) AS stock_actual,
    p.min_stock_alert
  FROM public.products p
  WHERE p.is_active = TRUE
    AND p.min_stock_alert IS NOT NULL
    AND public.get_stock_balance(p.id) <= p.min_stock_alert
    AND p.type IN ('MATERIA_PRIMA', 'INSUMO', 'ENVASE_EMPAQUE', 'PRODUCTO_A_GRANEL')
  ORDER BY
    (public.get_stock_balance(p.id) / NULLIF(p.min_stock_alert, 0)) ASC;
$$ LANGUAGE SQL STABLE;
