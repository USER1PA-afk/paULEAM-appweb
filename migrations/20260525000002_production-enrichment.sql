-- ============================================================
-- PAuleam ERP — Migración: Enriquecimiento de producción
-- ============================================================
-- Añade a production_orders:
--   batch_number      — identificador de lote de producción
--   scheduled_date    — fecha planificada
--   actual_yield      — rendimiento real (puede diferir del objetivo)
--   waste_quantity    — merma declarada
--   production_cost   — costo total calculado al completar
-- Funciones:
--   next_batch_number(prefix)  — genera PROD-YYYY-NNNN / EMP-YYYY-NNNN
--   convert_unit()             — conversión entre unidades de masa y volumen
-- Trigger:
--   process_production_completion — versión final con conversión de unidades
-- RPC:
--   declare_production_waste   — declara merma post-completado
-- ============================================================

-- ============================
-- 1. COLUMNAS EN production_orders
-- ============================
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS batch_number    TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_date  DATE,
  ADD COLUMN IF NOT EXISTS actual_yield    NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS waste_quantity  NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_cost NUMERIC(14,4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_production_batch
  ON public.production_orders(batch_number)
  WHERE batch_number IS NOT NULL;

-- ============================
-- 2. SECUENCIA Y GENERADOR DE LOTE
-- ============================
CREATE SEQUENCE IF NOT EXISTS public.production_batch_seq START 1;

-- prefix: 'PROD' para producción, 'EMP' para empaque
CREATE OR REPLACE FUNCTION public.next_batch_number(prefix TEXT DEFAULT 'PROD')
RETURNS TEXT AS $$
  SELECT prefix || '-' || TO_CHAR(now(), 'YYYY') || '-' ||
         LPAD(nextval('public.production_batch_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL;

-- ============================
-- 3. HELPER: CONVERSIÓN DE UNIDADES
-- ============================
-- Convierte p_value de p_from_unit a p_to_unit.
-- Solo funciona dentro del mismo grupo (masa o volumen).
-- Si las unidades son incompatibles devuelve el valor original.
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

  IF v_from_factor IS NULL OR v_to_factor IS NULL THEN
    RETURN p_value;
  END IF;

  RETURN p_value * (v_from_factor / v_to_factor);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================
-- 4. TRIGGER: MOTOR DE ESCALADO (versión final con conversión de unidades)
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

  NEW.production_cost := v_total_cost;
  NEW.completed_at    := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger ya existe (trg_production_completion), solo se reemplaza la función.

-- ============================
-- 5. RPC: DECLARAR MERMA
-- ============================
CREATE OR REPLACE FUNCTION public.declare_production_waste(
  p_order_id    UUID,
  p_waste_qty   NUMERIC,
  p_waste_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
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

  IF public.get_stock_balance(v_order.output_product_id) < p_waste_qty THEN
    RAISE EXCEPTION 'Stock insuficiente del producto terminado para declarar merma de %', p_waste_qty;
  END IF;

  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_order.output_product_id,
    'EGRESO',
    p_waste_qty,
    'MERMA',
    p_order_id,
    COALESCE(p_waste_notes, FORMAT('Merma declarada — Lote %s',
      COALESCE(v_order.batch_number, LEFT(p_order_id::TEXT, 8)))),
    auth.uid()
  );

  UPDATE public.production_orders
  SET waste_quantity = COALESCE(waste_quantity, 0) + p_waste_qty
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.declare_production_waste(UUID, NUMERIC, TEXT) TO authenticated;
