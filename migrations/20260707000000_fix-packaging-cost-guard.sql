-- ============================================================
-- PAuleam ERP — Migración: Corrección de Costos Calculados y Eliminación de set_config
-- ============================================================
--
-- Explicación del problema:
--   Insforge utiliza un pooler de conexiones (o proxy de base de datos)
--   que no permite modificar configuraciones de sesión SQL. Cualquier llamada a
--   `set_config` o `SET` produce el error:
--   "Changing SQL session configuration is not allowed."
--
-- Solución:
--   1. Redefinimos `protect_auto_computed_cost` para que permita la actualización
--      de `cost_per_unit` de productos auto-calculados (granel/terminado) siempre
--      que la actualización ocurra dentro de un trigger (`pg_trigger_depth() > 1`).
--      Esto valida de forma segura que la escritura viene de la lógica del sistema
--      (producción, empaque, WAC) y no de una modificación directa de un usuario.
--   2. Eliminamos todas las llamadas a `set_config` de los triggers del sistema:
--        - `process_production_completion`
--        - `fn_packaging_completion`
--        - `fn_wac_purchase_ingress`
--
-- ============================================================

-- ── 1. REDEFINIR FUNCIÓN DE PROTECCIÓN ───────────────────────────────────────
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

  -- Permitir si la escritura viene de una ejecución interna de trigger (depth > 1)
  -- Esto ocurre cuando se ejecuta dentro de un trigger de producción, empaque o WAC.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Mantener fallback para propósitos de compatibilidad
  IF current_setting('app.system_cost_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'El campo cost_per_unit del producto "%" (tipo: %) es calculado automáticamente por el sistema. '
    'No se puede modificar manualmente.',
    OLD.name, OLD.type;
END;
$$ LANGUAGE plpgsql;

-- Re-vincular trigger de protección
DROP TRIGGER IF EXISTS trg_protect_auto_cost ON public.products;
CREATE TRIGGER trg_protect_auto_cost
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_auto_computed_cost();


-- ── 2. REDEFINIR TRIGGERS DEL SISTEMA SIN set_config ──────────────────────────

-- A. fn_packaging_completion (Empaque de Producto Terminado)
CREATE OR REPLACE FUNCTION public.fn_packaging_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template            RECORD;
  v_material            RECORD;
  v_bulk_qty            NUMERIC;
  v_bulk_kg             NUMERIC;
  v_bulk_factor         NUMERIC;
  v_bulk_cost_per_unit  NUMERIC;
  v_total_cost          NUMERIC := 0;
  v_compare_qty         NUMERIC;
  v_compare_label       TEXT;
  v_available           NUMERIC;
  v_batch_label         TEXT;
  v_unit_cost_output    NUMERIC;
BEGIN
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  SELECT
    pt.id, pt.finished_product_id, pt.output_product_id,
    pt.bulk_qty_per_unit, pt.bulk_unit, pt.output_unit,
    fp.name AS finished_product_name,
    op.name AS output_product_name,
    fp.unit AS finished_product_unit
  INTO v_template
  FROM public.packaging_templates pt
  JOIN public.products fp ON fp.id = pt.finished_product_id
  JOIN public.products op ON op.id = pt.output_product_id
  WHERE pt.id = NEW.template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla de empaque % no encontrada', NEW.template_id;
  END IF;

  v_bulk_qty := NEW.units_to_package * v_template.bulk_qty_per_unit;
  NEW.bulk_quantity_consumed := v_bulk_qty;

  v_bulk_factor := public.unit_to_kg_factor(v_template.bulk_unit);
  v_bulk_kg     := v_bulk_qty * v_bulk_factor;

  IF NOT pg_try_advisory_xact_lock(hashtext(v_template.finished_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto "%" ocupado en otra transacción, intente de nuevo.',
      v_template.finished_product_name;
  END IF;

  v_available := public.get_stock_balance(v_template.finished_product_id);
  IF v_available < v_bulk_kg THEN
    RAISE EXCEPTION 'Stock insuficiente de "%". Requerido: % kg, Disponible: % kg',
      v_template.finished_product_name,
      ROUND(v_bulk_kg, 4),
      ROUND(v_available, 4);
  END IF;

  v_batch_label    := public.next_batch_number('EMP');
  NEW.batch_number := v_batch_label;

  SELECT COALESCE(cost_per_unit, 0) INTO v_bulk_cost_per_unit
  FROM public.products WHERE id = v_template.finished_product_id;

  v_total_cost := v_bulk_kg * v_bulk_cost_per_unit;

  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
  VALUES (
    v_template.finished_product_id,
    'EGRESO',
    v_bulk_kg,
    v_bulk_cost_per_unit,
    'EMPAQUE',
    NEW.id,
    FORMAT('Empaque %s: %s unidades × %s %s → %s kg',
      v_batch_label, NEW.units_to_package,
      v_template.bulk_qty_per_unit, v_template.bulk_unit,
      ROUND(v_bulk_kg, 4))
  );

  FOR v_material IN
    SELECT
      ptm.material_product_id,
      ptm.quantity_per_unit,
      ptm.unit,
      p.name                       AS material_name,
      COALESCE(p.cost_per_unit, 0) AS cost_per_unit
    FROM public.packaging_template_materials ptm
    JOIN public.products p ON p.id = ptm.material_product_id
    WHERE ptm.template_id = NEW.template_id
  LOOP
    IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
    END IF;

    v_available := public.get_stock_balance(v_material.material_product_id);

    IF lower(trim(v_material.unit)) IN
       ('unidad','unidades','ud','uds','pza','pieza','piezas','u') THEN
      v_compare_qty   := v_material.quantity_per_unit * NEW.units_to_package;
      v_compare_label := v_material.unit;
    ELSE
      v_compare_qty   := v_material.quantity_per_unit * NEW.units_to_package
                         * public.unit_to_kg_factor(v_material.unit);
      v_compare_label := 'kg';
    END IF;

    IF v_available < v_compare_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente de material "%". Requerido: % %, Disponible: % %',
        v_material.material_name,
        ROUND(v_compare_qty, 4), v_compare_label,
        ROUND(v_available, 4),   v_compare_label;
    END IF;

    v_total_cost := v_total_cost + (v_compare_qty * v_material.cost_per_unit);

    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
    VALUES (
      v_material.material_product_id,
      'EGRESO',
      v_compare_qty,
      v_material.cost_per_unit,
      'EMPAQUE',
      NEW.id,
      FORMAT('Material empaque %s: %s × %s %s',
        v_batch_label, NEW.units_to_package,
        v_material.quantity_per_unit, v_material.unit)
    );
  END LOOP;

  v_unit_cost_output := CASE WHEN NEW.units_to_package > 0
    THEN ROUND(v_total_cost / NEW.units_to_package, 4)
    ELSE 0 END;

  IF v_template.output_product_id <> v_template.finished_product_id THEN
    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
    VALUES (
      v_template.output_product_id,
      'INGRESO',
      NEW.units_to_package,
      v_unit_cost_output,
      'EMPAQUE',
      NEW.id,
      FORMAT('Empaque %s: %s %s producidas — Costo/u: $%s',
        v_batch_label, NEW.units_to_package, v_template.output_unit,
        ROUND(v_unit_cost_output, 4))
    );

    -- Se remueve set_config ya que pg_trigger_depth() > 1 autoriza la escritura
    UPDATE public.products
    SET cost_per_unit = v_unit_cost_output
    WHERE id = v_template.output_product_id;
  END IF;

  NEW.completed_at := now();
  RETURN NEW;
END;
$$;


-- B. process_production_completion (Producción de Producto a Granel con WAC)
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

  -- EGRESO de ingredientes
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

  v_unit_cost_batch := CASE WHEN v_effective_yield > 0
    THEN ROUND(v_total_cost / v_effective_yield, 4)
    ELSE 0 END;

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

  -- INGRESO del producto a granel
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

  -- Se remueve set_config ya que pg_trigger_depth() > 1 autoriza la escritura
  UPDATE public.products
  SET cost_per_unit = v_wac
  WHERE id = v_output_product_id;

  NEW.production_cost := v_total_cost;
  NEW.completed_at    := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. fn_wac_purchase_ingress (WAC para Compras y Ajustes Manuales)
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

  v_stock_after  := public.get_stock_balance(NEW.product_id);
  v_stock_before := v_stock_after - NEW.quantity;

  IF v_stock_before <= 0 THEN
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
    -- Se remueve set_config ya que pg_trigger_depth() > 1 autoriza la escritura
    UPDATE public.products
    SET cost_per_unit = v_wac
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
