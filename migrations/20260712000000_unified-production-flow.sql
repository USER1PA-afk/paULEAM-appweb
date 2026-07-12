-- ============================================================
-- PAuleam ERP — Migración: Flujo de Producción Unificado
-- ============================================================
-- Implementa el modelo de Formulación por Porcentajes:
--   - recipe_ingredients.percentage (NUMERIC(5,2))
--   - unified_production_orders      (tabla nueva)
--   - unified_production_presentations (tabla nueva, presentaciones por lote)
--   - RPC execute_unified_production (transacción atómica)
--
-- NO elimina ni modifica:
--   - production_orders / trg_production_completion
--   - packaging_orders / trg_packaging_completion
--   - packaging_templates / packaging_template_materials
-- ============================================================

-- ============================================================
-- FASE 0 — Parchear protect_auto_computed_cost ANTES de todo
-- ============================================================
-- execute_unified_production es un RPC SECURITY DEFINER que corre
-- a pg_trigger_depth() = 0.  Cuando hace UPDATE products, el trigger
-- se dispara a depth = 1.  La versión anterior (20260707000000) exigía
-- depth > 1, lo que bloquea el UPDATE del RPC.  Además, el fallback
-- current_setting('app.system_cost_update', true) que quedó en esa
-- migración también es rechazado por el pooler de Insforge con:
-- "Changing SQL session configuration is not allowed."
--
-- Solución: cambiar el umbral a >= 1 y eliminar current_setting().
--   depth = 0  → UPDATE manual desde cliente/dashboard → BLOQUEADO
--   depth = 1  → RPC SECURITY DEFINER (este módulo)    → PERMITIDO
--   depth >= 2 → trigger anidado (producción/empaque)   → PERMITIDO
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_auto_computed_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar cuando cost_per_unit cambia
  IF NEW.cost_per_unit IS NOT DISTINCT FROM OLD.cost_per_unit THEN
    RETURN NEW;
  END IF;

  -- Permitir si el tipo no es auto-calculado
  IF OLD.type NOT IN ('PRODUCTO_A_GRANEL', 'PRODUCTO_TERMINADO') THEN
    RETURN NEW;
  END IF;

  -- Permitir si la escritura viene de dentro de cualquier trigger o RPC
  -- del sistema (depth >= 1).
  -- depth = 0  → UPDATE manual desde cliente/dashboard → BLOQUEADO
  -- depth = 1  → RPC SECURITY DEFINER (execute_unified_production) → PERMITIDO
  -- depth >= 2 → trigger anidado (producción/empaque/WAC) → PERMITIDO
  IF pg_trigger_depth() >= 1 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'El campo cost_per_unit del producto "%" (tipo: %) es calculado '
    'automáticamente por el sistema. No se puede modificar manualmente.',
    OLD.name, OLD.type;
END;
$$ LANGUAGE plpgsql;
-- El trigger trg_protect_auto_cost ya existe; solo se reemplaza la función.

-- ============================================================
-- FASE 1A — recipe_ingredients: columna percentage
-- ============================================================

ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS percentage NUMERIC(14,4);

-- Retroalimentar filas existentes desde quantity / yield_base.
-- Sólo las filas donde percentage sigue NULL y yield_base > 0.
UPDATE public.recipe_ingredients ri
SET    percentage = ROUND((ri.quantity / r.yield_base) * 100.0, 4)
FROM   public.recipes r
WHERE  ri.recipe_id    = r.id
  AND  ri.percentage   IS NULL
  AND  r.yield_base    > 0;

COMMENT ON COLUMN public.recipe_ingredients.percentage IS
  'Porcentaje de este ingrediente sobre la masa total del lote (0-100). '
  'La suma de los porcentajes de una misma receta debe ser 100. '
  'El RPC execute_unified_production valida esto en tiempo de ejecución.';

-- ============================================================
-- FASE 1B — inventory_ledger: ampliar whitelist de reference_type
-- ============================================================
-- El constraint actual (de 20260709000001) NO incluye PRODUCCION_UNIFICADA.
-- Se dropea y recrea para añadirlo.

ALTER TABLE public.inventory_ledger
  DROP CONSTRAINT IF EXISTS inventory_ledger_reference_type_whitelist;

ALTER TABLE public.inventory_ledger
  ADD CONSTRAINT inventory_ledger_reference_type_whitelist
    CHECK (reference_type IS NULL OR reference_type IN (
      'COMPRA',
      'PRODUCCION',
      'PRODUCCION_DEMANDA',
      'PRODUCCION_UNIFICADA',
      'VENTA',
      'VENTA_DEMANDA',
      'AJUSTE',
      'EMPAQUE',
      'MERMA',
      'RESERVA',
      'INVENTARIO_FISICO',
      'DEVOLUCION',
      'INICIAL'
    ));

-- ============================================================
-- FASE 1C — enforce_finished_product_ingress: aceptar PRODUCCION_UNIFICADA
-- ============================================================
-- La función vigente (de 20260709000000) permite PRODUCCION, PRODUCCION_DEMANDA,
-- EMPAQUE y AJUSTE para PRODUCTO_TERMINADO.  Añadimos PRODUCCION_UNIFICADA.
-- También preserva la regla de PRODUCTO_A_GRANEL (sólo PRODUCCION / AJUSTE).

CREATE OR REPLACE FUNCTION public.enforce_finished_product_ingress()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  IF NEW.movement_type = 'INGRESO' THEN
    SELECT type INTO v_type FROM public.products WHERE id = NEW.product_id;

    IF v_type = 'PRODUCTO_A_GRANEL'
       AND NEW.reference_type NOT IN ('PRODUCCION', 'AJUSTE') THEN
      RAISE EXCEPTION
        'Un PRODUCTO_A_GRANEL solo puede recibir INGRESO por PRODUCCION o AJUSTE. Se recibió: %',
        NEW.reference_type;
    END IF;

    IF v_type = 'PRODUCTO_TERMINADO'
       AND NEW.reference_type NOT IN (
         'PRODUCCION',
         'PRODUCCION_DEMANDA',
         'PRODUCCION_UNIFICADA',
         'EMPAQUE',
         'AJUSTE'
       ) THEN
      RAISE EXCEPTION
        'Un PRODUCTO_TERMINADO solo puede recibir INGRESO por PRODUCCION, '
        'PRODUCCION_DEMANDA, PRODUCCION_UNIFICADA, EMPAQUE o AJUSTE. '
        'Se recibió: %',
        NEW.reference_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe (trg_enforce_finished_ingress) — sólo se reemplazó la función.

-- ============================================================
-- FASE 1D — Nuevas tablas: unified_production_orders + presentations
-- (creadas ANTES de la vista para evitar forward reference)
-- ============================================================

-- ── Tabla principal del lote unificado ──────────────────────
CREATE TABLE IF NOT EXISTS public.unified_production_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  batch_kg        NUMERIC(14,4) NOT NULL CHECK (batch_kg > 0),
  status          public.production_status NOT NULL DEFAULT 'BORRADOR',
  batch_number    TEXT,
  scheduled_date  DATE,
  -- Campos rellenados al completar:
  actual_batch_kg NUMERIC(14,4),          -- kg reales producidos (= batch_kg - waste_kg)
  production_cost NUMERIC(14,4) DEFAULT 0, -- costo total de materia prima + insumos
  waste_kg        NUMERIC(14,4) DEFAULT 0, -- merma declarada manualmente en Block C
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_prod_orders_status
  ON public.unified_production_orders(status);

CREATE INDEX IF NOT EXISTS idx_unified_prod_orders_recipe
  ON public.unified_production_orders(recipe_id);

CREATE INDEX IF NOT EXISTS idx_unified_prod_orders_batch
  ON public.unified_production_orders(batch_number)
  WHERE batch_number IS NOT NULL;

CREATE TRIGGER trg_unified_orders_updated_at
  BEFORE UPDATE ON public.unified_production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Presentaciones comerciales del lote ─────────────────────
-- Cada fila = una presentación (PRODUCTO_TERMINADO) y las unidades
-- a empacar en este lote.
CREATE TABLE IF NOT EXISTS public.unified_production_presentations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL
                     REFERENCES public.unified_production_orders(id) ON DELETE CASCADE,
  product_id       UUID        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  units_to_produce NUMERIC(14,4) NOT NULL CHECK (units_to_produce > 0),
  capacity_kg      NUMERIC(14,4) NOT NULL CHECK (capacity_kg > 0),
    -- Snapshot en el momento de la creación de la orden:
    -- = products.capacity * unit_to_kg_factor(products.capacity_unit)
  total_kg         NUMERIC(14,4) NOT NULL CHECK (total_kg > 0),
    -- = units_to_produce * capacity_kg
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_unified_presentation UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_presentations_order
  ON public.unified_production_presentations(order_id);

-- Trigger: product_id debe ser PRODUCTO_TERMINADO
CREATE OR REPLACE FUNCTION public.enforce_unified_presentation_type()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  SELECT type INTO v_type FROM public.products WHERE id = NEW.product_id;
  IF v_type <> 'PRODUCTO_TERMINADO' THEN
    RAISE EXCEPTION
      'Las presentaciones del lote unificado deben ser PRODUCTO_TERMINADO. '
      'Producto % es de tipo %', NEW.product_id, v_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_unified_presentation
  ON public.unified_production_presentations;

CREATE TRIGGER trg_enforce_unified_presentation
  BEFORE INSERT OR UPDATE ON public.unified_production_presentations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unified_presentation_type();

-- ============================================================
-- FASE 1E — inventory_ledger_view: añadir PRODUCCION_UNIFICADA al label
-- (creada DESPUÉS de unified_production_orders para evitar forward reference)
-- ============================================================
DROP VIEW IF EXISTS public.inventory_ledger_view CASCADE;

CREATE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  p.name       AS product_name,
  p.sku        AS product_sku,
  p.unit       AS product_unit,
  p.type       AS product_type,
  s.company    AS supplier_company,
  s.name       AS supplier_name,
  s.ruc        AS supplier_ruc,
  r.name       AS production_recipe_name,
  po.batch_number AS production_batch_number,
  upo.batch_number AS unified_batch_number,
  pt.name      AS packaging_template_name,
  CASE il.reference_type
    WHEN 'COMPRA'                THEN 'Compra / Recepción'
    WHEN 'PRODUCCION'            THEN 'Producción'
    WHEN 'PRODUCCION_DEMANDA'    THEN 'Producción bajo demanda'
    WHEN 'PRODUCCION_UNIFICADA'  THEN 'Producción unificada'
    WHEN 'EMPAQUE'               THEN 'Empaque'
    WHEN 'VENTA'                 THEN 'Venta'
    WHEN 'VENTA_DEMANDA'         THEN 'Venta bajo demanda'
    WHEN 'AJUSTE'                THEN 'Ajuste'
    WHEN 'MERMA'                 THEN 'Merma / Pérdida'
    WHEN 'DEVOLUCION'            THEN 'Devolución'
    ELSE COALESCE(il.reference_type, '—')
  END AS reference_type_label
FROM public.inventory_ledger il
LEFT JOIN public.products p ON p.id = il.product_id
LEFT JOIN public.suppliers s ON s.id = il.supplier_id
LEFT JOIN public.production_orders po
  ON po.id = il.reference_id AND il.reference_type = 'PRODUCCION'
LEFT JOIN public.recipes r ON r.id = po.recipe_id
LEFT JOIN public.packaging_orders pkg_o
  ON pkg_o.id = il.reference_id AND il.reference_type = 'EMPAQUE'
LEFT JOIN public.packaging_templates pt ON pt.id = pkg_o.template_id
LEFT JOIN public.unified_production_orders upo
  ON upo.id = il.reference_id AND il.reference_type = 'PRODUCCION_UNIFICADA';

GRANT SELECT ON public.inventory_ledger_view TO authenticated;

-- ============================================================
-- FASE 2 — RPC: execute_unified_production
-- ============================================================
--
-- Lógica atómica al "Completar lote":
--
--   1. Validar orden BORRADOR + sumar porcentajes ≈ 100
--   2. EGRESO de cada ingrediente (MATERIA_PRIMA / INSUMO)
--      cantidad = (percentage / 100) * batch_kg  convertida a stock_unit
--   3. Por cada presentación:
--        a. Buscar packaging_template donde output_product_id = presentation.product_id
--        b. Sólo materiales de tipo ENVASE_EMPAQUE (excluye MATERIAL_SECUNDARIO)
--        c. EGRESO de cada material primario
--   4. INGRESO de cada presentación (PRODUCTO_TERMINADO)
--      con unit_cost calculado proporcionalmente por masa:
--        costo_presentación_i = costo_total_MP * (total_kg_i / batch_kg)
--                               + costo_materiales_primarios_i
--        unit_cost_i = costo_presentación_i / units_to_produce_i
--      WAC actualizado en products.cost_per_unit (dentro del trigger depth > 1)
--   5. Marcar orden COMPLETADA + batch_number + completed_at + production_cost
--
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
  v_total_raw_cost  NUMERIC := 0;   -- costo acumulado de materia prima + insumos
  v_ingredient_cost NUMERIC;

  -- Por presentación
  v_pres_raw_cost   NUMERIC;        -- fracción del costo de MP asignada a esta presentación
  v_mat_qty         NUMERIC;
  v_mat_cost        NUMERIC;
  v_mat_total_cost  NUMERIC;        -- costo total de materiales primarios de esta presentación
  v_unit_cost_pres  NUMERIC;        -- costo unitario final de la presentación

  -- WAC
  v_stock_before    NUMERIC;
  v_old_catalog_cost NUMERIC;
  v_wac             NUMERIC;

  -- Misc
  v_batch_label     TEXT;
  v_compare_qty     NUMERIC;
  v_compare_label   TEXT;
  v_available       NUMERIC;
  v_total_pres_kg   NUMERIC;  -- masa total de presentaciones (validación)
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


  -- Validar suma de porcentajes ≈ 100 (tolerancia ±0.10)
  SELECT COALESCE(SUM(ri.percentage), 0)
  INTO   v_pct_sum
  FROM   public.recipe_ingredients ri
  WHERE  ri.recipe_id = v_order.recipe_id
    AND  ri.percentage IS NOT NULL;

  IF ABS(v_pct_sum - 100.0) > 0.10 THEN
    RAISE EXCEPTION
      'La suma de porcentajes de la receta "%" es % (debe ser 100 ± 0.10). '
      'Corrija los porcentajes antes de producir.',
      v_recipe.recipe_name,
      ROUND(v_pct_sum, 2);
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
      'kg',                         -- los porcentajes siempre son en masa (kg)
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
    -- ── Costo de MP proporcional a la masa de esta presentación ──
    v_pres_raw_cost := v_total_raw_cost
                       * (v_presentation.total_kg / v_order.batch_kg);

    v_mat_total_cost := 0;

    -- ── Buscar plantilla de empaque para este PRODUCTO_TERMINADO ──
    -- packaging_templates.output_product_id = el producto terminado final
    -- Tomamos la primera plantilla activa (debería ser única por producto terminado)
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
    -- (se excluyen MATERIAL_SECUNDARIO = cajas, cartones)
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
          AND p2.type = 'ENVASE_EMPAQUE'   -- SÓLO primarios; excluye MATERIAL_SECUNDARIO
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
    END IF;  -- fin IF plantilla encontrada

    -- ── Costo unitario proporcional para esta presentación ────────
    --   unit_cost_i = (costo_MP_proporcional_i + costo_materiales_i)
    --                  / units_to_produce_i
    v_unit_cost_pres := CASE
      WHEN v_presentation.units_to_produce > 0
        THEN ROUND(
               (v_pres_raw_cost + v_mat_total_cost)
               / v_presentation.units_to_produce,
               4
             )
      ELSE 0
    END;

    -- ── WAC para el producto terminado ────────────────────────────
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

    -- ── INGRESO del producto terminado ────────────────────────────
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

    -- ── Actualizar WAC en catálogo ────────────────────────────────
    -- protect_auto_computed_cost usa pg_trigger_depth() >= 1.
    -- Este UPDATE desde el RPC dispara el trigger a depth = 1 → permitido.
    -- NO se usa configuracion de sesion (incompatible con el pooler de Insforge).
    UPDATE public.products
    SET cost_per_unit = v_wac
    WHERE id = v_presentation.product_id;

  END LOOP;  -- fin de presentaciones

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

-- ============================================================
-- FASE 2B — RLS para las nuevas tablas
-- ============================================================

ALTER TABLE public.unified_production_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_production_presentations ENABLE ROW LEVEL SECURITY;

-- unified_production_orders — staff lee todo; operario/admin puede insertar y actualizar

DROP POLICY IF EXISTS "unified_prod_orders_select_staff"
  ON public.unified_production_orders;
CREATE POLICY "unified_prod_orders_select_staff"
  ON public.unified_production_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_orders_insert_staff"
  ON public.unified_production_orders;
CREATE POLICY "unified_prod_orders_insert_staff"
  ON public.unified_production_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_orders_update_staff"
  ON public.unified_production_orders;
CREATE POLICY "unified_prod_orders_update_staff"
  ON public.unified_production_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_orders_delete_admin"
  ON public.unified_production_orders;
CREATE POLICY "unified_prod_orders_delete_admin"
  ON public.unified_production_orders FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- unified_production_presentations — mismos permisos que la orden padre

DROP POLICY IF EXISTS "unified_prod_pres_select_staff"
  ON public.unified_production_presentations;
CREATE POLICY "unified_prod_pres_select_staff"
  ON public.unified_production_presentations FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_pres_insert_staff"
  ON public.unified_production_presentations;
CREATE POLICY "unified_prod_pres_insert_staff"
  ON public.unified_production_presentations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_pres_update_staff"
  ON public.unified_production_presentations;
CREATE POLICY "unified_prod_pres_update_staff"
  ON public.unified_production_presentations FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "unified_prod_pres_delete_staff"
  ON public.unified_production_presentations;
CREATE POLICY "unified_prod_pres_delete_staff"
  ON public.unified_production_presentations FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- ============================================================
-- FASE 2C — stock_summary: reconstruir con CASCADE resuelto
-- ============================================================
-- inventory_ledger_view fue dropeada con CASCADE en FASE 1D.
-- stock_summary usa DROP VIEW IF EXISTS CASCADE en la migración
-- 20260709000000 — se vuelve a garantizar el GRANT aquí:
GRANT SELECT ON public.stock_summary TO authenticated, anon;
