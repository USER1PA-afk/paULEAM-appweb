-- ============================================================
-- PAuleam ERP — Migración: Costo Promedio Ponderado (WAC) en producción
-- ============================================================
-- Corrige Gaps #1 y #2 de auditoría:
--   1. Tras calcular unit_cost_batch, aplica WAC y actualiza products.cost_per_unit
--      del producto a granel resultante.
--   2. Usa set_config('app.system_cost_update','true',true) para que el trigger
--      de protección (Gap #5) permita la escritura del sistema sin bloquearla.
--
-- Fórmula WAC:
--   Si stock_actual <= 0 → new_cost = unit_cost_batch
--   Si stock_actual >  0 → new_cost = (stock_actual × old_cost + qty_lote × unit_cost_batch)
--                                      / (stock_actual + qty_lote)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_production_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe                 RECORD;
  v_ingredient             RECORD;
  v_scale_factor           NUMERIC;
  v_required_qty           NUMERIC;
  v_required_in_stock_unit NUMERIC;
  v_current_stock          NUMERIC;
  v_output_product_id      UUID;
  v_effective_yield        NUMERIC;
  v_total_cost             NUMERIC := 0;
  v_ingredient_cost        NUMERIC;
  v_batch_label            TEXT;
  -- WAC
  v_unit_cost_batch        NUMERIC;
  v_stock_before_ingreso   NUMERIC;
  v_old_catalog_cost       NUMERIC;
  v_wac                    NUMERIC;
BEGIN
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    NEW.batch_number := public.next_batch_number();
  END IF;

  SELECT r.id, r.yield_base, r.output_product_id, r.name AS recipe_name
  INTO v_recipe
  FROM public.recipes r
  WHERE r.id = NEW.recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta no encontrada para la orden de producción %', NEW.id;
  END IF;

  v_output_product_id := v_recipe.output_product_id;

  v_effective_yield := COALESCE(NULLIF(NEW.actual_yield, 0), NEW.target_yield);
  NEW.actual_yield  := v_effective_yield;

  v_scale_factor := v_effective_yield / v_recipe.yield_base;

  IF v_scale_factor <= 0 THEN
    RAISE EXCEPTION 'Factor de escala inválido (%). Rendimiento efectivo: %, Rendimiento base: %',
      v_scale_factor, v_effective_yield, v_recipe.yield_base;
  END IF;

  v_batch_label := COALESCE(NEW.batch_number, LEFT(NEW.id::TEXT, 8));

  -- ============================
  -- EGRESO de ingredientes + acumulación de costo
  -- ============================
  FOR v_ingredient IN
    SELECT
      ri.product_id,
      ri.quantity,
      ri.unit        AS recipe_unit,
      ri.ingredient_role,
      p.name         AS product_name,
      p.sku          AS product_sku,
      p.unit         AS stock_unit,
      p.cost_per_unit
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.product_id
    WHERE ri.recipe_id = NEW.recipe_id
  LOOP
    v_required_qty := v_ingredient.quantity * v_scale_factor;

    v_required_in_stock_unit := public.convert_unit(
      v_required_qty,
      v_ingredient.recipe_unit,
      v_ingredient.stock_unit
    );

    v_current_stock := public.get_stock_balance(v_ingredient.product_id);

    IF v_current_stock < v_required_in_stock_unit THEN
      RAISE EXCEPTION
        'Stock insuficiente de "%" (SKU: %). Requerido: % %, Disponible: % %',
        v_ingredient.product_name,
        v_ingredient.product_sku,
        ROUND(v_required_in_stock_unit, 4),
        v_ingredient.stock_unit,
        ROUND(v_current_stock, 4),
        v_ingredient.stock_unit;
    END IF;

    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_ingredient.product_id,
      'EGRESO',
      v_required_in_stock_unit,
      COALESCE(v_ingredient.cost_per_unit, 0),
      'PRODUCCION',
      NEW.id,
      FORMAT('Lote %s — Receta: %s — %s — Factor: %s',
        v_batch_label,
        v_recipe.recipe_name,
        v_ingredient.ingredient_role,
        ROUND(v_scale_factor, 4)),
      NEW.created_by
    );

    v_ingredient_cost := v_required_in_stock_unit * COALESCE(v_ingredient.cost_per_unit, 0);
    v_total_cost      := v_total_cost + v_ingredient_cost;
  END LOOP;

  -- ============================
  -- Costo unitario del lote
  -- ============================
  v_unit_cost_batch := CASE WHEN v_effective_yield > 0
    THEN ROUND(v_total_cost / v_effective_yield, 4)
    ELSE 0 END;

  -- ============================
  -- WAC: stock del producto de salida ANTES del INGRESO
  -- (los EGRESOs de arriba no afectan el balance del output_product)
  -- ============================
  v_stock_before_ingreso := public.get_stock_balance(v_output_product_id);

  SELECT COALESCE(cost_per_unit, 0) INTO v_old_catalog_cost
  FROM public.products WHERE id = v_output_product_id;

  IF v_stock_before_ingreso <= 0 THEN
    v_wac := v_unit_cost_batch;
  ELSE
    v_wac := ROUND(
      (v_stock_before_ingreso * v_old_catalog_cost + v_effective_yield * v_unit_cost_batch)
      / (v_stock_before_ingreso + v_effective_yield),
      4
    );
  END IF;

  -- ============================
  -- INGRESO del producto a granel (unit_cost = costo de este lote)
  -- ============================
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_output_product_id,
    'INGRESO',
    v_effective_yield,
    v_unit_cost_batch,
    'PRODUCCION',
    NEW.id,
    FORMAT('Lote %s — Producción completada — Rendimiento: %s — Costo/u lote: $%s',
      v_batch_label,
      v_effective_yield,
      ROUND(v_unit_cost_batch, 4)),
    NEW.created_by
  );

  -- ============================
  -- Actualizar catálogo con el WAC (señalando al trigger de protección que es escritura del sistema)
  -- ============================
  PERFORM set_config('app.system_cost_update', 'true', true);

  UPDATE public.products
  SET cost_per_unit = v_wac
  WHERE id = v_output_product_id;

  PERFORM set_config('app.system_cost_update', 'false', true);

  NEW.production_cost := v_total_cost;
  NEW.completed_at    := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger trg_production_completion ya existe; solo se reemplaza la función.
