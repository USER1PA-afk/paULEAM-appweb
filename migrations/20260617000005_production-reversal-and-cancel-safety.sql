-- ============================================================
-- PAuleam ERP — Production Reversal & Cancel Safety
-- ============================================================
-- 1. Adds explicit CANCELADA guard to production trigger
-- 2. Creates reverse_production_order() RPC for admin corrections
-- ============================================================

-- ============================
-- 1. Safety: reject CANCELADA in production trigger
-- ============================
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
  -- Explicit block: never process inventory for canceled orders
  IF NEW.status = 'CANCELADA' THEN
    RETURN NEW;
  END IF;

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
  -- INGRESO del producto a granel
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
  -- Actualizar catálogo con el WAC
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


-- ============================
-- 2. reverse_production_order() — Admin reversal RPC
-- ============================
-- Reads all PRODUCCION ledger entries for a completed order,
-- inserts counter-movements (AJUSTE), and resets the order to BORRADOR.
-- Safety: skips finished-product EGRESO if waste was already declared,
-- and validates stock before every EGRESO to prevent negative balances.
-- ============================
CREATE OR REPLACE FUNCTION public.reverse_production_order(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order           RECORD;
  v_movement        RECORD;
  v_reversed_count  INT := 0;
  v_has_waste       BOOLEAN := FALSE;
  v_current_stock   NUMERIC;
  v_output_product  UUID;
BEGIN
  -- ── Validate order ──────────────────────────────────────
  SELECT * INTO v_order
  FROM public.production_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de producción % no encontrada', p_order_id;
  END IF;

  IF v_order.status <> 'COMPLETADA' THEN
    RAISE EXCEPTION 'Solo se pueden revertir órdenes COMPLETADAS. Estado actual: %', v_order.status;
  END IF;

  -- ── Check if waste was declared ─────────────────────────
  v_has_waste := COALESCE(v_order.waste_quantity, 0) > 0;

  -- Get the output product to identify the INGRESO entry
  SELECT r.output_product_id INTO v_output_product
  FROM public.recipes r
  WHERE r.id = v_order.recipe_id;

  -- ── Reverse PRODUCCION ledger entries ───────────────────
  FOR v_movement IN
    SELECT *
    FROM public.inventory_ledger
    WHERE reference_type = 'PRODUCCION'
      AND reference_id = p_order_id
    ORDER BY created_at DESC
  LOOP
    IF v_movement.movement_type = 'INGRESO' AND v_movement.product_id = v_output_product THEN
      -- This is the finished product INGRESO.
      -- If waste was declared, the finished product was already removed by waste.
      -- The reversal must ADD IT BACK (undo the waste) so stock returns to 0.
      IF v_has_waste THEN
        INSERT INTO public.inventory_ledger (
          product_id, movement_type, quantity,
          reference_type, reference_id, notes, created_by
        ) VALUES (
          v_movement.product_id,
          'INGRESO',
          v_movement.quantity,
          'AJUSTE',
          p_order_id,
          FORMAT('Reversión de producción — Restauración de producto terminado tras merma — Orden %s',
            COALESCE(v_order.batch_number, LEFT(p_order_id::TEXT, 8))),
          auth.uid()
        );
        v_reversed_count := v_reversed_count + 1;
        CONTINUE;
      END IF;

      -- No waste declared → check stock before removing
      v_current_stock := public.get_stock_balance(v_movement.product_id);

      IF v_current_stock < v_movement.quantity THEN
        RAISE EXCEPTION
          'No se puede revertir: stock insuficiente del producto terminado "%". Stock actual: %, Necesario: %',
          v_movement.product_id, ROUND(v_current_stock, 4), ROUND(v_movement.quantity, 4);
      END IF;

      INSERT INTO public.inventory_ledger (
        product_id, movement_type, quantity,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_movement.product_id,
        'EGRESO',
        v_movement.quantity,
        'AJUSTE',
        p_order_id,
        FORMAT('Reversión de producción — Contrapartida de INGRESO %s — Orden %s',
          LEFT(v_movement.id::TEXT, 8),
          COALESCE(v_order.batch_number, LEFT(p_order_id::TEXT, 8))),
        auth.uid()
      );

    ELSIF v_movement.movement_type = 'EGRESO' THEN
      -- Raw material EGRESO → restore with INGRESO (no stock check needed)
      INSERT INTO public.inventory_ledger (
        product_id, movement_type, quantity,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_movement.product_id,
        'INGRESO',
        v_movement.quantity,
        'AJUSTE',
        p_order_id,
        FORMAT('Reversión de producción — Contrapartida de EGRESO %s — Orden %s',
          LEFT(v_movement.id::TEXT, 8),
          COALESCE(v_order.batch_number, LEFT(p_order_id::TEXT, 8))),
        auth.uid()
      );
    END IF;

    v_reversed_count := v_reversed_count + 1;
  END LOOP;

  IF v_reversed_count = 0 THEN
    RAISE EXCEPTION 'No se encontraron movimientos de inventario para la orden %. ¿Fue completada por el trigger?', p_order_id;
  END IF;

  -- ── Reset order to BORRADOR ─────────────────────────────
  UPDATE public.production_orders
  SET
    status          = 'BORRADOR',
    actual_yield    = NULL,
    production_cost = NULL,
    completed_at    = NULL,
    waste_quantity  = 0,
    batch_number    = NULL,
    notes           = COALESCE(notes, '') || E'\n[REVERTIDA — Movimientos revertidos con AJUSTE]'
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_production_order(UUID) TO authenticated;
