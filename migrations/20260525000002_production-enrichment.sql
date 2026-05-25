-- ============================================================
-- PAuleam ERP — Migración: Enriquecimiento de producción
-- ============================================================
-- Añade a production_orders:
--   batch_number      — identificador de lote de producción
--   scheduled_date    — fecha planificada
--   actual_yield      — rendimiento real (puede diferir del objetivo)
--   waste_quantity    — merma declarada
--   production_cost   — costo total calculado al completar
-- Actualiza el trigger de producción para:
--   - Incluir batch_number en notas del ledger
--   - Usar actual_yield si se provee (fallback a target_yield)
--   - Calcular production_cost como suma(qty_escalada * cost_per_unit)
-- ============================================================

-- 1. Nuevos campos en production_orders
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS batch_number    TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_date  DATE,
  ADD COLUMN IF NOT EXISTS actual_yield    NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS waste_quantity  NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_cost NUMERIC(14,4) DEFAULT 0;

-- Índice para búsqueda por número de lote
CREATE INDEX IF NOT EXISTS idx_production_batch
  ON public.production_orders(batch_number)
  WHERE batch_number IS NOT NULL;

-- 2. Secuencia para auto-generación de batch_number
CREATE SEQUENCE IF NOT EXISTS public.production_batch_seq START 1;

-- Función para generar el próximo número de lote
CREATE OR REPLACE FUNCTION public.next_batch_number()
RETURNS TEXT AS $$
  SELECT 'PROD-' || TO_CHAR(now(), 'YYYY') || '-' ||
         LPAD(nextval('public.production_batch_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL;

-- 3. Trigger actualizado del motor de escalado
--    Se reemplaza la función process_production_completion existente.
CREATE OR REPLACE FUNCTION public.process_production_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe            RECORD;
  v_ingredient        RECORD;
  v_scale_factor      NUMERIC;
  v_required_qty      NUMERIC;
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

  -- Rendimiento efectivo: usar actual_yield si se ingresó, de lo contrario target_yield
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
      ri.unit,
      ri.ingredient_role,
      p.name         AS product_name,
      p.sku          AS product_sku,
      p.cost_per_unit
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.product_id
    WHERE ri.recipe_id = NEW.recipe_id
  LOOP
    v_required_qty := v_ingredient.quantity * v_scale_factor;

    -- Verificar stock
    v_current_stock := public.get_stock_balance(v_ingredient.product_id);

    IF v_current_stock < v_required_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente de "%" (SKU: %). Requerido: % %, Disponible: % %',
        v_ingredient.product_name,
        v_ingredient.product_sku,
        ROUND(v_required_qty, 4),
        v_ingredient.unit,
        ROUND(v_current_stock, 4),
        v_ingredient.unit;
    END IF;

    -- EGRESO del ingrediente
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_ingredient.product_id,
      'EGRESO',
      v_required_qty,
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

    -- Acumular costo
    v_ingredient_cost := v_required_qty * COALESCE(v_ingredient.cost_per_unit, 0);
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

-- El trigger ya existe (trg_production_completion), solo se reemplaza la función.

-- 4. RPC para declarar merma después de completar producción
CREATE OR REPLACE FUNCTION public.declare_production_waste(
  p_order_id      UUID,
  p_waste_qty     NUMERIC,
  p_waste_notes   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order     RECORD;
  v_recipe    RECORD;
BEGIN
  -- Verificar que la orden existe y está COMPLETADA
  SELECT po.*, r.output_product_id, r.name AS recipe_name
  INTO v_order
  FROM public.production_orders po
  JOIN public.recipes r ON r.id = po.recipe_id
  WHERE po.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de producción % no encontrada', p_order_id;
  END IF;

  IF v_order.status <> 'COMPLETADA' THEN
    RAISE EXCEPTION 'Solo se puede declarar merma en órdenes COMPLETADAS. Estado actual: %', v_order.status;
  END IF;

  IF p_waste_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad de merma debe ser mayor a 0';
  END IF;

  -- Verificar stock suficiente para la merma
  IF public.get_stock_balance(v_order.output_product_id) < p_waste_qty THEN
    RAISE EXCEPTION 'Stock insuficiente del producto terminado para declarar merma de %', p_waste_qty;
  END IF;

  -- EGRESO de merma
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_order.output_product_id,
    'EGRESO',
    p_waste_qty,
    'MERMA',
    p_order_id,
    COALESCE(p_waste_notes, FORMAT('Merma declarada — Lote %s', COALESCE(v_order.batch_number, LEFT(p_order_id::TEXT, 8)))),
    auth.uid()
  );

  -- Actualizar waste_quantity acumulado en la orden
  UPDATE public.production_orders
  SET waste_quantity = COALESCE(waste_quantity, 0) + p_waste_qty
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.declare_production_waste(UUID, NUMERIC, TEXT) TO authenticated;
