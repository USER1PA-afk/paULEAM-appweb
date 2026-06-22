CREATE OR REPLACE FUNCTION public.unit_to_kg_factor(p_unit TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE lower(trim(p_unit))
    WHEN 'kg'     THEN RETURN 1;
    WHEN 'kilo'   THEN RETURN 1;
    WHEN 'kilos'  THEN RETURN 1;
    WHEN 'g'      THEN RETURN 0.001;
    WHEN 'gs'     THEN RETURN 0.001;
    WHEN 'gr'     THEN RETURN 0.001;
    WHEN 'gramo'  THEN RETURN 0.001;
    WHEN 'gramos' THEN RETURN 0.001;
    WHEN 'mg'     THEN RETURN 0.000001;
    WHEN 'lb'     THEN RETURN 0.453592;
    WHEN 'libra'  THEN RETURN 0.453592;
    WHEN 'libras' THEN RETURN 0.453592;
    WHEN 'oz'     THEN RETURN 0.0283495;
    WHEN 'l'      THEN RETURN 1;  -- litros: mismo factor base
    WHEN 'lt'     THEN RETURN 1;
    WHEN 'litro'  THEN RETURN 1;
    WHEN 'litros' THEN RETURN 1;
    WHEN 'ml'     THEN RETURN 0.001;
    ELSE RETURN 1;  -- unidad desconocida: sin conversión
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_packaging_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template  RECORD;
  v_material  RECORD;
  v_bulk_qty  NUMERIC;   -- en unidad de la plantilla (ej: gramos)
  v_bulk_kg   NUMERIC;   -- en kg (lo que compara con el ledger)
  v_mat_qty   NUMERIC;
  v_mat_kg    NUMERIC;
  v_available NUMERIC;
  v_batch_label TEXT;
  v_bulk_factor  NUMERIC;
  v_mat_factor   NUMERIC;
BEGIN
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  -- Cargar plantilla con datos de productos
  SELECT
    pt.id,
    pt.finished_product_id,
    pt.output_product_id,
    pt.bulk_qty_per_unit,
    pt.bulk_unit,
    pt.output_unit,
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

  -- Calcular cantidad granel consumida (en unidades de la plantilla)
  v_bulk_qty := NEW.units_to_package * v_template.bulk_qty_per_unit;
  NEW.bulk_quantity_consumed := v_bulk_qty;

  -- Convertir a kg para comparar con el ledger
  v_bulk_factor := public.unit_to_kg_factor(v_template.bulk_unit);
  v_bulk_kg := v_bulk_qty * v_bulk_factor;

  -- Advisory lock para evitar condiciones de carrera
  IF NOT pg_try_advisory_xact_lock(hashtext(v_template.finished_product_id::text)) THEN
    RAISE EXCEPTION 'Producto "%" ocupado en otra transacción, intente de nuevo.',
      v_template.finished_product_name;
  END IF;

  -- Validar stock del producto a granel (siempre en kg en el ledger)
  v_available := public.get_stock_balance(v_template.finished_product_id);
  IF v_available < v_bulk_kg THEN
    RAISE EXCEPTION
      'Stock insuficiente de "%". Requerido: % kg, Disponible: % kg',
      v_template.finished_product_name,
      ROUND(v_bulk_kg, 4),
      ROUND(v_available, 4);
  END IF;

  -- Generar número de lote
  v_batch_label := public.next_batch_number('EMP');
  NEW.batch_number := v_batch_label;

  -- EGRESO del producto a granel (siempre en kg)
  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, reference_type, reference_id, notes)
  VALUES (
    v_template.finished_product_id,
    'EGRESO',
    v_bulk_kg,
    'EMPAQUE',
    NEW.id,
    format('Empaque %s: %s unidades × %s %s → %s kg',
      v_batch_label,
      NEW.units_to_package,
      v_template.bulk_qty_per_unit,
      v_template.bulk_unit,
      ROUND(v_bulk_kg, 4))
  );

  -- Procesar cada material (ENVASE_EMPAQUE)
  FOR v_material IN
    SELECT
      ptm.material_product_id,
      ptm.quantity_per_unit,
      ptm.unit,
      p.name AS material_name,
      p.unit AS product_unit
    FROM public.packaging_template_materials ptm
    JOIN public.products p ON p.id = ptm.material_product_id
    WHERE ptm.template_id = NEW.template_id
  LOOP
    v_mat_qty := v_material.quantity_per_unit * NEW.units_to_package;
    v_mat_factor := public.unit_to_kg_factor(v_material.unit);
    v_mat_kg := v_mat_qty * v_mat_factor;

    -- Usar la unidad base del material para el ledger
    -- Si el material no es kg-based (ej: unidades de envase), comparar directo
    -- Los envases suelen estar en "unidad", no kg → factor = 1, sin conversión
    IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::text)) THEN
      RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
    END IF;

    v_available := public.get_stock_balance(v_material.material_product_id);
    -- Para materiales en unidades (envases), comparar qty directa sin factor kg
    -- Para materiales en peso (relleno, etc.), usar v_mat_kg
    DECLARE
      v_compare_qty NUMERIC;
      v_compare_label TEXT;
    BEGIN
      IF lower(trim(v_material.unit)) IN ('unidad','unidades','ud','uds','pza','pieza','piezas','u') THEN
        v_compare_qty := v_mat_qty;
        v_compare_label := v_material.unit;
      ELSE
        v_compare_qty := v_mat_kg;
        v_compare_label := 'kg';
      END IF;

      IF v_available < v_compare_qty THEN
        RAISE EXCEPTION
          'Stock insuficiente de material "%". Requerido: % %s, Disponible: % %s',
          v_material.material_name,
          ROUND(v_compare_qty, 4), v_compare_label,
          ROUND(v_available, 4), v_compare_label;
      END IF;

      INSERT INTO public.inventory_ledger
        (product_id, movement_type, quantity, reference_type, reference_id, notes)
      VALUES (
        v_material.material_product_id,
        'EGRESO',
        v_compare_qty,
        'EMPAQUE',
        NEW.id,
        format('Material empaque %s: %s × %s %s',
          v_batch_label, NEW.units_to_package,
          v_material.quantity_per_unit, v_material.unit)
      );
    END;
  END LOOP;

  -- INGRESO del producto empacado (si es distinto al granel)
  IF v_template.output_product_id <> v_template.finished_product_id THEN
    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, reference_type, reference_id, notes)
    VALUES (
      v_template.output_product_id,
      'INGRESO',
      NEW.units_to_package,
      'EMPAQUE',
      NEW.id,
      format('Empaque %s: %s %s producidas',
        v_batch_label, NEW.units_to_package, v_template.output_unit)
    );
  END IF;

  NEW.completed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_packaging_completion ON public.packaging_orders;

CREATE TRIGGER trg_packaging_completion
  BEFORE UPDATE ON public.packaging_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_packaging_completion();
