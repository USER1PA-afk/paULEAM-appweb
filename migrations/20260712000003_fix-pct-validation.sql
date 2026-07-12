-- ============================================================
-- PAuleam ERP — Fix: Eliminar validación incorrecta SUM(%) = 100
-- en execute_unified_production
-- ============================================================
-- CONTEXTO: Las recetas de concentración (queso, conservas) tienen
-- ratio INPUT/OUTPUT > 1. Para 1 kg de queso se necesitan 6.54 kg
-- de leche/crema/sal → SUM(percentage) = 654%.
--
-- La fórmula required_kg = (pct/100) × batch_kg sigue siendo correcta.
-- Solo se elimina la restricción ABS(SUM - 100) <= 0.10.
--
-- Nuevo criterio de validación:
--   - SUM(percentage) > 0  (la receta tiene al menos un ingrediente)
--   - Ningún porcentaje es NULL  (todos los ingredientes calculados)
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_unified_production(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order           RECORD;
  v_recipe          RECORD;
  v_ingredient      RECORD;
  v_presentation    RECORD;
  v_material        RECORD;
  v_template        RECORD;

  -- Porcentajes
  v_pct_sum         NUMERIC;

  -- Cantidades de ingredientes
  v_required_kg     NUMERIC;
  v_required_stock  NUMERIC;
  v_current_stock   NUMERIC;

  -- Acumuladores de costo
  v_total_raw_cost  NUMERIC := 0;
  v_ingredient_cost NUMERIC;

  -- Por presentación
  v_pres_raw_cost   NUMERIC;
  v_mat_qty         NUMERIC;
  v_mat_cost        NUMERIC;
  v_mat_total_cost  NUMERIC;
  v_unit_cost_pres  NUMERIC;

  -- WAC
  v_stock_before     NUMERIC;
  v_old_catalog_cost NUMERIC;
  v_wac              NUMERIC;

  -- Misc
  v_batch_label     TEXT;
  v_compare_qty     NUMERIC;
  v_compare_label   TEXT;
  v_available       NUMERIC;
  v_total_pres_kg   NUMERIC;
BEGIN

  -- ============================================================
  -- PASO 1 — Cargar y validar la orden
  -- ============================================================
  SELECT *
  INTO   v_order
  FROM   public.unified_production_orders
  WHERE  id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden unificada % no encontrada.', p_order_id;
  END IF;

  IF v_order.status <> 'BORRADOR' THEN
    RAISE EXCEPTION
      'Solo se pueden completar órdenes en estado BORRADOR. '
      'Estado actual: %', v_order.status;
  END IF;

  -- Cargar receta
  SELECT r.id, r.name AS recipe_name, r.yield_base, r.yield_unit,
         r.output_product_id
  INTO   v_recipe
  FROM   public.recipes r
  WHERE  r.id = v_order.recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta % no encontrada para la orden %.', v_order.recipe_id, p_order_id;
  END IF;

  -- Validar que hay al menos una presentación
  IF NOT EXISTS (
    SELECT 1 FROM public.unified_production_presentations WHERE order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'La orden % no tiene presentaciones comerciales definidas.', p_order_id;
  END IF;

  -- Validar que la suma de total_kg de presentaciones no excede batch_kg
  -- (tolerancia de 0.5 kg para redondeos)
  SELECT COALESCE(SUM(total_kg), 0)
  INTO   v_total_pres_kg
  FROM   public.unified_production_presentations
  WHERE  order_id = p_order_id;

  IF v_total_pres_kg > (v_order.batch_kg + 0.5) THEN
    RAISE EXCEPTION
      'La masa total de las presentaciones (% kg) supera el lote (% kg). '
      'Ajuste las unidades antes de completar.',
      ROUND(v_total_pres_kg, 4),
      ROUND(v_order.batch_kg, 4);
  END IF;

  -- ── VALIDACIÓN CORREGIDA (era ABS(SUM-100)<=0.10, incorrecto) ──
  -- Las recetas de concentración/evaporación tienen SUM > 100 por diseño.
  -- Solo se requiere que existan porcentajes positivos y ninguno sea NULL.
  SELECT COALESCE(SUM(ri.percentage), 0)
  INTO   v_pct_sum
  FROM   public.recipe_ingredients ri
  WHERE  ri.recipe_id = v_order.recipe_id
    AND  ri.percentage IS NOT NULL;

  IF v_pct_sum <= 0 THEN
    RAISE EXCEPTION
      'La receta "%" no tiene porcentajes de ingredientes definidos. '
      'Actualice la receta antes de producir.',
      v_recipe.recipe_name;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   public.recipe_ingredients
    WHERE  recipe_id = v_order.recipe_id
      AND  percentage IS NULL
  ) THEN
    RAISE EXCEPTION
      'La receta "%" tiene ingredientes sin porcentaje. '
      'Actualice los ingredientes antes de producir.',
      v_recipe.recipe_name;
  END IF;

  -- Generar número de lote
  v_batch_label := public.next_batch_number('PROD');

  -- ============================================================
  -- PASO 2 — EGRESO de ingredientes (MATERIA_PRIMA / INSUMO)
  -- ============================================================
  FOR v_ingredient IN
    SELECT
      ri.product_id,
      ri.percentage,
      ri.ingredient_role,
      p.name         AS product_name,
      p.sku          AS product_sku,
      p.unit         AS stock_unit,
      COALESCE(p.cost_per_unit, 0) AS cost_per_unit
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.product_id
    WHERE ri.recipe_id = v_order.recipe_id
      AND ri.percentage IS NOT NULL
  LOOP
    -- Cantidad requerida en kg según porcentaje
    v_required_kg := (v_ingredient.percentage / 100.0) * v_order.batch_kg;

    -- Convertir a unidad de stock del ingrediente
    v_required_stock := public.convert_unit(
      v_required_kg,
      'kg',
      v_ingredient.stock_unit
    );

    -- Verificar stock
    IF NOT pg_try_advisory_xact_lock(hashtext(v_ingredient.product_id::TEXT)) THEN
      RAISE EXCEPTION 'Ingrediente "%" ocupado en otra transacción.', v_ingredient.product_name;
    END IF;

    v_current_stock := public.get_stock_balance(v_ingredient.product_id);

    IF v_current_stock < v_required_stock THEN
      RAISE EXCEPTION
        'Stock insuficiente de "%" (SKU: %). '
        'Requerido: % %, Disponible: % %',
        v_ingredient.product_name,
        v_ingredient.product_sku,
        ROUND(v_required_stock, 4), v_ingredient.stock_unit,
        ROUND(v_current_stock, 4),  v_ingredient.stock_unit;
    END IF;

    -- EGRESO del ingrediente
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_ingredient.product_id,
      'EGRESO',
      v_required_stock,
      v_ingredient.cost_per_unit,
      'PRODUCCION_UNIFICADA',
      p_order_id,
      FORMAT('Lote %s — Receta: %s — %s — %s%% de %s kg',
        v_batch_label,
        v_recipe.recipe_name,
        v_ingredient.ingredient_role,
        ROUND(v_ingredient.percentage, 2),
        ROUND(v_order.batch_kg, 4)),
      v_order.created_by
    );

    -- Acumular costo de materia prima
    v_ingredient_cost := v_required_stock * v_ingredient.cost_per_unit;
    v_total_raw_cost  := v_total_raw_cost + v_ingredient_cost;
  END LOOP;

  -- ============================================================
  -- PASO 3 + 4 — Por cada presentación:
  --              EGRESO materiales primarios + INGRESO terminado
  -- ============================================================
  FOR v_presentation IN
    SELECT
      upp.id          AS pres_id,
      upp.product_id,
      upp.units_to_produce,
      upp.capacity_kg,
      upp.total_kg,
      p.name          AS product_name,
      COALESCE(p.cost_per_unit, 0) AS old_catalog_cost
    FROM public.unified_production_presentations upp
    JOIN public.products p ON p.id = upp.product_id
    WHERE upp.order_id = p_order_id
    ORDER BY upp.created_at
  LOOP
    -- Costo de MP proporcional a la masa de esta presentación
    v_pres_raw_cost := v_total_raw_cost
                       * (v_presentation.total_kg / v_order.batch_kg);

    v_mat_total_cost := 0;

    -- Buscar plantilla de empaque activa para este PRODUCTO_TERMINADO
    SELECT
      pt.id AS template_id,
      pt.output_product_id,
      pt.output_unit
    INTO v_template
    FROM public.packaging_templates pt
    WHERE pt.output_product_id = v_presentation.product_id
      AND pt.is_active = TRUE
    ORDER BY pt.created_at
    LIMIT 1;

    -- Si existe plantilla, consumir SÓLO los materiales ENVASE_EMPAQUE
    IF FOUND THEN
      FOR v_material IN
        SELECT
          ptm.material_product_id,
          ptm.quantity_per_unit,
          ptm.unit,
          p2.name                        AS material_name,
          p2.type                        AS material_type,
          COALESCE(p2.cost_per_unit, 0)  AS cost_per_unit
        FROM public.packaging_template_materials ptm
        JOIN public.products p2 ON p2.id = ptm.material_product_id
        WHERE ptm.template_id = v_template.template_id
          AND p2.type = 'ENVASE_EMPAQUE'
      LOOP
        -- Cantidad de material para las unidades de esta presentación
        IF lower(trim(v_material.unit)) IN
           ('unidad','unidades','ud','uds','pza','pieza','piezas','u') THEN
          v_compare_qty   := v_material.quantity_per_unit * v_presentation.units_to_produce;
          v_compare_label := v_material.unit;
        ELSE
          v_compare_qty   := v_material.quantity_per_unit
                             * v_presentation.units_to_produce
                             * public.unit_to_kg_factor(v_material.unit);
          v_compare_label := 'kg';
        END IF;

        -- Bloqueo + verificación de stock del material
        IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::TEXT)) THEN
          RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
        END IF;

        v_available := public.get_stock_balance(v_material.material_product_id);

        IF v_available < v_compare_qty THEN
          RAISE EXCEPTION
            'Stock insuficiente del material de empaque "%". '
            'Requerido: % %, Disponible: % %',
            v_material.material_name,
            ROUND(v_compare_qty, 4), v_compare_label,
            ROUND(v_available, 4),   v_compare_label;
        END IF;

        -- EGRESO del material primario
        INSERT INTO public.inventory_ledger (
          product_id, movement_type, quantity, unit_cost,
          reference_type, reference_id, notes, created_by
        ) VALUES (
          v_material.material_product_id,
          'EGRESO',
          v_compare_qty,
          v_material.cost_per_unit,
          'PRODUCCION_UNIFICADA',
          p_order_id,
          FORMAT('Lote %s — Material empaque para "%": %s × %s %s',
            v_batch_label,
            v_presentation.product_name,
            v_presentation.units_to_produce,
            v_material.quantity_per_unit,
            v_material.unit),
          v_order.created_by
        );

        -- Acumular costo de materiales de esta presentación
        v_mat_cost       := v_compare_qty * v_material.cost_per_unit;
        v_mat_total_cost := v_mat_total_cost + v_mat_cost;
      END LOOP;
    END IF;

    -- Costo unitario proporcional para esta presentación
    v_unit_cost_pres := CASE
      WHEN v_presentation.units_to_produce > 0
        THEN ROUND(
               (v_pres_raw_cost + v_mat_total_cost)
               / v_presentation.units_to_produce,
               4
             )
      ELSE 0
    END;

    -- WAC para el producto terminado
    IF NOT pg_try_advisory_xact_lock(hashtext(v_presentation.product_id::TEXT)) THEN
      RAISE EXCEPTION
        'Producto terminado "%" ocupado en otra transacción.', v_presentation.product_name;
    END IF;

    v_stock_before     := public.get_stock_balance(v_presentation.product_id);
    v_old_catalog_cost := v_presentation.old_catalog_cost;

    IF v_stock_before <= 0 THEN
      v_wac := v_unit_cost_pres;
    ELSE
      v_wac := ROUND(
        (v_stock_before * v_old_catalog_cost
         + v_presentation.units_to_produce * v_unit_cost_pres)
        / (v_stock_before + v_presentation.units_to_produce),
        4
      );
    END IF;

    -- INGRESO del producto terminado
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_presentation.product_id,
      'INGRESO',
      v_presentation.units_to_produce,
      v_unit_cost_pres,
      'PRODUCCION_UNIFICADA',
      p_order_id,
      FORMAT('Lote %s — "%": %s unidades × %s kg — Costo/u: $%s',
        v_batch_label,
        v_presentation.product_name,
        v_presentation.units_to_produce,
        ROUND(v_presentation.capacity_kg, 4),
        ROUND(v_unit_cost_pres, 4)),
      v_order.created_by
    );

    -- Actualizar WAC en catálogo
    UPDATE public.products
    SET cost_per_unit = v_wac
    WHERE id = v_presentation.product_id;

  END LOOP;

  -- ============================================================
  -- PASO 5 — Actualizar orden a COMPLETADA
  -- ============================================================
  UPDATE public.unified_production_orders
  SET
    status          = 'COMPLETADA',
    batch_number    = v_batch_label,
    actual_batch_kg = v_order.batch_kg - COALESCE(v_order.waste_kg, 0),
    production_cost = v_total_raw_cost,
    completed_at    = now(),
    updated_at      = now()
  WHERE id = p_order_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_unified_production(UUID) TO authenticated;
