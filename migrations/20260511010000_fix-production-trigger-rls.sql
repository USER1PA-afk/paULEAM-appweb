-- ============================================================
-- PAuleam ERP — Fix: Trigger de Producción + RLS en inventory_ledger
-- ============================================================
-- Problema: el trigger process_production_completion() usa SECURITY DEFINER
-- pero los INSERT en inventory_ledger aún pasan por RLS porque PostgREST
-- evalúa auth.uid() = NULL dentro del contexto del trigger en algunos paths.
--
-- Solución:
-- 1. Reemplazar la función del trigger marcándola explícitamente con
--    SET row_security = off para sus propios INSERTs internos.
-- 2. Añadir una política RLS PERMISSIVA para el rol "authenticated" que
--    permita INSERTs donde el created_by coincide con auth.uid() OR
--    cuando el INSERT proviene de una producción (reference_type = 'PRODUCCION').
-- ============================================================

-- Política adicional: permitir inserts de producción aunque vengan del trigger
-- (el trigger pasa created_by = NEW.created_by que puede ser NULL si la orden
--  se creó antes de tener el campo lleno)
DROP POLICY IF EXISTS "ledger_insert_production_trigger" ON public.inventory_ledger;
CREATE POLICY "ledger_insert_production_trigger"
  ON public.inventory_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    reference_type = 'PRODUCCION'
    AND public.get_user_role() IN ('admin', 'operario')
  );

-- Reemplazar la función del trigger con SET row_security = off
-- para que sus INSERTs internos en inventory_ledger no pasen por RLS
CREATE OR REPLACE FUNCTION public.process_production_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
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
    v_required_qty := v_ingredient.quantity * v_scale_factor;

    -- Verificar stock disponible (usa get_stock_balance que también tiene SET row_security = off via STABLE)
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
$$;
