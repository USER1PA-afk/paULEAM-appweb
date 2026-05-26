-- ============================================================
-- PAuleam ERP — Migración: Conversión de unidades en triggers
-- ============================================================
-- Añade función convert_unit() y actualiza process_production_completion
-- para convertir ingredientes a la unidad del producto antes de comparar stock.
-- ============================================================

-- ============================
-- 1. FUNCIÓN: convert_unit
-- ============================
-- Convierte un valor de p_from_unit a p_to_unit.
-- Solo funciona para unidades del mismo grupo (masa o volumen).
-- Si las unidades son incompatibles devuelve el valor original (sin error).
CREATE OR REPLACE FUNCTION public.convert_unit(
  p_value     NUMERIC,
  p_from_unit TEXT,
  p_to_unit   TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_from_factor NUMERIC;
  v_to_factor   NUMERIC;
BEGIN
  IF LOWER(p_from_unit) = LOWER(p_to_unit) THEN
    RETURN p_value;
  END IF;

  -- Factor = cuántas unidades base (g o ml) equivale 1 de esta unidad
  v_from_factor := CASE LOWER(p_from_unit)
    WHEN 'g'   THEN 1
    WHEN 'kg'  THEN 1000
    WHEN 'lb'  THEN 453.592
    WHEN 'oz'  THEN 28.3495
    WHEN 'ml'  THEN 1
    WHEN 'lt'  THEN 1000
    WHEN 'gal' THEN 3785.41
    ELSE NULL
  END;

  v_to_factor := CASE LOWER(p_to_unit)
    WHEN 'g'   THEN 1
    WHEN 'kg'  THEN 1000
    WHEN 'lb'  THEN 453.592
    WHEN 'oz'  THEN 28.3495
    WHEN 'ml'  THEN 1
    WHEN 'lt'  THEN 1000
    WHEN 'gal' THEN 3785.41
    ELSE NULL
  END;

  -- Si alguna unidad no es conocida o son de grupos distintos, devolver sin convertir
  IF v_from_factor IS NULL OR v_to_factor IS NULL THEN
    RETURN p_value;
  END IF;

  RETURN p_value * (v_from_factor / v_to_factor);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================
-- 2. TRIGGER ACTUALIZADO: process_production_completion
-- ============================
-- Cambios respecto a la versión anterior:
--   - Obtiene products.unit para cada ingrediente
--   - Convierte v_required_qty de la unidad de la receta a la unidad del producto
--     antes de comparar stock y antes de insertar el EGRESO
--   - El mensaje de error muestra ambas unidades cuando difieren
CREATE OR REPLACE FUNCTION public.process_production_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe            RECORD;
  v_ingredient        RECORD;
  v_scale_factor      NUMERIC;
  v_required_qty      NUMERIC;   -- en unidad de la receta
  v_required_in_stock_unit NUMERIC; -- en unidad del producto (ledger)
  v_current_stock     NUMERIC;
  v_output_product_id UUID;
  v_effective_yield   NUMERIC;
  v_total_cost        NUMERIC := 0;
  v_ingredient_cost   NUMERIC;
  v_batch_label       TEXT;
BEGIN
  -- Solo actuar cuando status cambia a COMPLETADA
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  -- Auto-generar batch_number si no se proveyó
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    NEW.batch_number := public.next_batch_number();
  END IF;

  -- Obtener la receta asociada
  SELECT r.id, r.yield_base, r.output_product_id, r.name AS recipe_name
  INTO v_recipe
  FROM public.recipes r
  WHERE r.id = NEW.recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta no encontrada para la orden de producción %', NEW.id;
  END IF;

  v_output_product_id := v_recipe.output_product_id;

  -- Rendimiento efectivo
  v_effective_yield := COALESCE(NULLIF(NEW.actual_yield, 0), NEW.target_yield);
  NEW.actual_yield := v_effective_yield;

  -- Factor de escala
  v_scale_factor := v_effective_yield / v_recipe.yield_base;

  IF v_scale_factor <= 0 THEN
    RAISE EXCEPTION 'Factor de escala inválido (%). Rendimiento efectivo: %, Rendimiento base: %',
      v_scale_factor, v_effective_yield, v_recipe.yield_base;
  END IF;

  v_batch_label := COALESCE(NEW.batch_number, LEFT(NEW.id::TEXT, 8));

  -- Iterar ingredientes, descontar stock y acumular costo
  FOR v_ingredient IN
    SELECT
      ri.product_id,
      ri.quantity,
      ri.unit          AS recipe_unit,
      ri.ingredient_role,
      p.name           AS product_name,
      p.sku            AS product_sku,
      p.unit           AS stock_unit,   -- unidad en que está registrado el stock
      p.cost_per_unit
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.product_id
    WHERE ri.recipe_id = NEW.recipe_id
  LOOP
    -- Cantidad requerida en la unidad de la receta
    v_required_qty := v_ingredient.quantity * v_scale_factor;

    -- Convertir a la unidad del producto (en que está el stock del ledger)
    v_required_in_stock_unit := public.convert_unit(
      v_required_qty,
      v_ingredient.recipe_unit,
      v_ingredient.stock_unit
    );

    -- Verificar stock (el ledger está siempre en stock_unit)
    v_current_stock := public.get_stock_balance(v_ingredient.product_id);

    IF v_current_stock < v_required_in_stock_unit THEN
      RAISE EXCEPTION
        'Stock insuficiente de "%" (SKU: %). Requerido: % %s, Disponible: % %s',
        v_ingredient.product_name,
        v_ingredient.product_sku,
        ROUND(v_required_in_stock_unit, 4),
        v_ingredient.stock_unit,
        ROUND(v_current_stock, 4),
        v_ingredient.stock_unit;
    END IF;

    -- EGRESO en la unidad del producto (stock_unit)
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

    -- Acumular costo (usando la cantidad en stock_unit × cost_per_unit)
    v_ingredient_cost := v_required_in_stock_unit * COALESCE(v_ingredient.cost_per_unit, 0);
    v_total_cost := v_total_cost + v_ingredient_cost;
  END LOOP;

  -- INGRESO del producto terminado
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_output_product_id,
    'INGRESO',
    v_effective_yield,
    CASE WHEN v_effective_yield > 0 THEN ROUND(v_total_cost / v_effective_yield, 4) ELSE 0 END,
    'PRODUCCION',
    NEW.id,
    FORMAT('Lote %s — Producción completada — Rendimiento: %s',
      v_batch_label,
      v_effective_yield),
    NEW.created_by
  );

  -- Guardar costo total y timestamp
  NEW.production_cost := v_total_cost;
  NEW.completed_at    := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
