-- ============================================================
-- PAuleam ERP — Migración: WAC en ingresos de compra/ajuste
-- ============================================================
-- Tras cualquier INGRESO en inventory_ledger para tipos comprables
-- (MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, MATERIAL_SECUNDARIO),
-- recalcula products.cost_per_unit usando el Costo Promedio Ponderado.
--
-- Fórmula WAC:
--   stock_antes = balance_actual − qty_ingreso
--   Si stock_antes <= 0  → new_cost = unit_cost del ingreso
--   Si stock_antes >  0  → new_cost = (stock_antes × old_cost + qty × new_cost)
--                                      / (stock_antes + qty)
--
-- Solo aplica cuando:
--   • movement_type = 'INGRESO'
--   • reference_type IN ('COMPRA', 'AJUSTE', 'DEVOLUCION', 'INICIAL')
--   • unit_cost > 0  (ingresos en 0 no actualizan el catálogo)
--   • tipo del producto es comprable (no PRODUCTO_A_GRANEL / PRODUCTO_TERMINADO,
--     cuyos costos ya se gestionan por sus propios triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_wac_purchase_ingress()
RETURNS TRIGGER AS $$
DECLARE
  v_product_type  public.product_type;
  v_old_cost      NUMERIC;
  v_stock_after   NUMERIC;
  v_stock_before  NUMERIC;
  v_wac           NUMERIC;
BEGIN
  -- Solo ingresos con costo registrado
  IF NEW.movement_type <> 'INGRESO' THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Solo movimientos de compra/ajuste manual (producción y empaque tienen su propio WAC)
  IF NEW.reference_type NOT IN ('COMPRA', 'AJUSTE', 'DEVOLUCION', 'INICIAL') THEN
    RETURN NEW;
  END IF;

  -- Verificar que el producto sea de tipo comprable
  SELECT type, COALESCE(cost_per_unit, 0)
  INTO v_product_type, v_old_cost
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_product_type NOT IN ('MATERIA_PRIMA', 'INSUMO', 'ENVASE_EMPAQUE', 'MATERIAL_SECUNDARIO') THEN
    RETURN NEW;
  END IF;

  -- balance ya incluye la fila recién insertada (trigger AFTER)
  v_stock_after  := public.get_stock_balance(NEW.product_id);
  v_stock_before := v_stock_after - NEW.quantity;

  IF v_stock_before <= 0 THEN
    -- Sin stock previo: el nuevo costo reemplaza directamente
    v_wac := ROUND(NEW.unit_cost, 4);
  ELSE
    v_wac := ROUND(
      (v_stock_before * v_old_cost + NEW.quantity * NEW.unit_cost)
      / (v_stock_before + NEW.quantity),
      4
    );
  END IF;

  -- Solo escribir si el costo realmente cambia
  IF v_wac IS DISTINCT FROM v_old_cost THEN
    -- Señalar al trigger de protección que es escritura del sistema
    PERFORM set_config('app.system_cost_update', 'true', true);

    UPDATE public.products
    SET cost_per_unit = v_wac
    WHERE id = NEW.product_id;

    PERFORM set_config('app.system_cost_update', 'false', true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_wac_purchase_ingress ON public.inventory_ledger;
CREATE TRIGGER trg_wac_purchase_ingress
  AFTER INSERT ON public.inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_wac_purchase_ingress();
