-- ============================================================
-- PAuleam ERP — Migración: Tipos de producto (Parte 2/2)
-- Depende de 20260525000000 (enum ya committed).
-- Añade: columnas cost_per_unit/min_stock_alert, triggers de protección,
--        función get_low_stock_products.
-- ============================================================

-- 1. Campos de control de stock y costo
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS cost_per_unit   NUMERIC(12,4) NOT NULL DEFAULT 0;

-- 2. Trigger: impedir cambio de tipo si ya hay movimientos en ledger
CREATE OR REPLACE FUNCTION public.prevent_product_type_change()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    SELECT COUNT(*) INTO v_count
    FROM public.inventory_ledger
    WHERE product_id = OLD.id;

    IF v_count > 0 THEN
      RAISE EXCEPTION
        'No se puede cambiar el tipo del producto "%" porque ya tiene % movimiento(s) en inventario.',
        OLD.name, v_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_product_type_change ON public.products;
CREATE TRIGGER trg_prevent_product_type_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_product_type_change();

-- 3. Trigger: solo PRODUCCION/EMPAQUE/AJUSTE puede generar INGRESO para PRODUCTO_TERMINADO
CREATE OR REPLACE FUNCTION public.enforce_finished_product_ingress()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  IF NEW.movement_type = 'INGRESO' THEN
    SELECT type INTO v_type
    FROM public.products
    WHERE id = NEW.product_id;

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

DROP TRIGGER IF EXISTS trg_enforce_finished_ingress ON public.inventory_ledger;
CREATE TRIGGER trg_enforce_finished_ingress
  BEFORE INSERT ON public.inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_finished_product_ingress();

-- 4. Función auxiliar para alerta de stock mínimo
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
    AND p.type IN ('MATERIA_PRIMA', 'INSUMO', 'ENVASE_EMPAQUE')
  ORDER BY
    (public.get_stock_balance(p.id) / NULLIF(p.min_stock_alert, 0)) ASC;
$$ LANGUAGE SQL STABLE;
