-- ============================================================
-- PAuleam ERP — Migración 003: Trigger de Producción
-- ============================================================
-- Motor de Escalado: Cuando una production_order pasa a COMPLETADA,
-- calcula el factor de escala, descuenta materia prima e inyecta
-- producto terminado. Todo atómico con RAISE EXCEPTION para rollback.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_production_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe            RECORD;
  v_ingredient        RECORD;
  v_scale_factor      NUMERIC;
  v_required_qty      NUMERIC;
  v_current_stock     NUMERIC;
  v_output_product_id UUID;
BEGIN
  -- Solo actuar cuando el status cambia a COMPLETADA
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  -- Obtener la receta asociada
  SELECT r.id, r.yield_base, r.output_product_id
  INTO v_recipe
  FROM public.recipes r
  WHERE r.id = NEW.recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta no encontrada para la orden de producción %', NEW.id;
  END IF;

  v_output_product_id := v_recipe.output_product_id;

  -- ======================
  -- CALCULAR FACTOR DE ESCALA
  -- ======================
  -- factor = rendimiento_orden / rendimiento_base
  v_scale_factor := NEW.target_yield / v_recipe.yield_base;

  IF v_scale_factor <= 0 THEN
    RAISE EXCEPTION 'Factor de escala inválido (%). Rendimiento objetivo: %, Rendimiento base: %',
      v_scale_factor, NEW.target_yield, v_recipe.yield_base;
  END IF;

  -- ======================
  -- ITERAR INGREDIENTES Y DESCONTAR
  -- ======================
  FOR v_ingredient IN
    SELECT ri.product_id, ri.quantity, ri.unit, p.name AS product_name
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.product_id
    WHERE ri.recipe_id = NEW.recipe_id
  LOOP
    -- Cantidad requerida escalada
    v_required_qty := v_ingredient.quantity * v_scale_factor;

    -- Verificar stock disponible
    v_current_stock := public.get_stock_balance(v_ingredient.product_id);

    IF v_current_stock < v_required_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente de "%" (SKU: %). Requerido: % %, Disponible: % %',
        v_ingredient.product_name,
        (SELECT sku FROM public.products WHERE id = v_ingredient.product_id),
        ROUND(v_required_qty, 4),
        v_ingredient.unit,
        ROUND(v_current_stock, 4),
        v_ingredient.unit;
    END IF;

    -- Registrar EGRESO de materia prima
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
    ) VALUES (
      v_ingredient.product_id,
      'EGRESO',
      v_required_qty,
      'PRODUCCION',
      NEW.id,
      FORMAT('Producción #%s — Receta: %s — Factor: %s',
        LEFT(NEW.id::TEXT, 8),
        (SELECT name FROM public.recipes WHERE id = NEW.recipe_id),
        ROUND(v_scale_factor, 4)),
      NEW.created_by
    );
  END LOOP;

  -- ======================
  -- INYECTAR PRODUCTO TERMINADO
  -- ======================
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity, reference_type, reference_id, notes, created_by
  ) VALUES (
    v_output_product_id,
    'INGRESO',
    NEW.target_yield,
    'PRODUCCION',
    NEW.id,
    FORMAT('Producción completada #%s — Rendimiento: %s',
      LEFT(NEW.id::TEXT, 8),
      NEW.target_yield),
    NEW.created_by
  );

  -- Registrar timestamp de completado
  NEW.completed_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta ANTES de la actualización
-- (BEFORE UPDATE para poder modificar completed_at en NEW)
CREATE TRIGGER trg_production_completion
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_production_completion();
