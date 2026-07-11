-- ============================================================
-- PAuleam ERP — Migración: Costo de empaque y producto terminado
-- ============================================================
-- Corrige fn_packaging_completion (Gap #3 de auditoría):
--   1. Acumula costo = (bulk_kg × bulk.cost_per_unit) + SUM(mat_qty × mat.cost_per_unit)
--   2. Escribe unit_cost en todos los INSERTs al ledger (EGRESO y el INGRESO final)
--   3. Actualiza products.cost_per_unit del producto terminado con el costo calculado
-- ============================================================

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

  -- Cantidad a granel en la unidad de la plantilla
  v_bulk_qty := NEW.units_to_package * v_template.bulk_qty_per_unit;
  NEW.bulk_quantity_consumed := v_bulk_qty;

  -- Convertir a kg para comparar con el ledger
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

  -- Generar número de lote EMP-YYYY-NNNN
  v_batch_label    := public.next_batch_number('EMP');
  NEW.batch_number := v_batch_label;

  -- Costo unitario del producto a granel consumido
  SELECT COALESCE(cost_per_unit, 0) INTO v_bulk_cost_per_unit
  FROM public.products WHERE id = v_template.finished_product_id;

  -- Acumular costo del granel consumido
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
      p.name                        AS material_name,
      COALESCE(p.cost_per_unit, 0)  AS cost_per_unit
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

    -- Acumular costo del material consumido
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

  -- Costo unitario del producto empacado = total_cost / unidades producidas
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

    -- Propagar costo calculado al catálogo de productos
    UPDATE public.products
    SET cost_per_unit = v_unit_cost_output
    WHERE id = v_template.output_product_id;
  END IF;

  NEW.completed_at := now();
  RETURN NEW;
END;
$$;
