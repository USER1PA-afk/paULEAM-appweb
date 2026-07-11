-- ============================================================
-- PAuleam ERP — fn_packaging_completion unit consistency
-- ============================================================
-- The previous trigger used unit_to_kg_factor() to convert
-- every quantity to kg before inserting the ledger EGRESO /
-- INGRESO. For products stored in non-kg units (Unidad, Libra,
-- etc.) the ledger ended up with kg values while the product
-- itself was tracked in pieces — the same unit-mismatch class
-- that drove PT-001 to -7.
--
-- New helper qty_to_product_stock_unit() converts from a
-- template/material's declared unit to the product's canonical
-- stock_unit, with three fallback paths:
--   1. Identity when source equals stock_unit.
--   2. convert_unit() when both are recognised (g/kg/lb/oz/ml/lt/gal).
--   3. unit_to_kg_factor() fallback (treats unknown units as 1
--      each — the original behaviour, preserved as a last resort).
--
-- After this migration, every EGRESO and INGRESO lands in the
-- product's stock_unit, so get_stock_balance() arithmetic is
-- consistent and the guard trigger can do its job.
-- ============================================================

CREATE OR REPLACE FUNCTION public.qty_to_product_stock_unit(
  p_qty         NUMERIC,
  p_source_unit TEXT,
  p_product_id  UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_stock_unit   TEXT;
  v_via_convert  NUMERIC;
  v_src_norm     TEXT := LOWER(TRIM(COALESCE(p_source_unit, '')));
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.unit), ''), 'kg')
  INTO v_stock_unit
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_stock_unit IS NULL THEN
    RAISE EXCEPTION 'Producto % no encontrado o sin unidad', p_product_id;
  END IF;

  IF v_src_norm = LOWER(v_stock_unit) THEN
    RETURN ROUND(p_qty, 4);
  END IF;

  v_via_convert := public.convert_unit(p_qty, p_source_unit, v_stock_unit);

  IF v_via_convert IS DISTINCT FROM p_qty
     OR v_src_norm IN (
       'g','gs','gr','gramo','gramos',
       'kg','kilo','kilos',
       'lb','libra','libras','oz',
       'ml','l','lt','litro','litros','gal'
     )
  THEN
    RETURN ROUND(v_via_convert, 4);
  END IF;

  RETURN ROUND(p_qty * public.unit_to_kg_factor(p_source_unit), 4);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qty_to_product_stock_unit(NUMERIC, TEXT, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.fn_packaging_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template            RECORD;
  v_material            RECORD;
  v_bulk_qty            NUMERIC;
  v_bulk_in_stock       NUMERIC;
  v_bulk_cost_per_unit  NUMERIC;
  v_mat_qty             NUMERIC;
  v_mat_in_stock        NUMERIC;
  v_total_cost          NUMERIC := 0;
  v_material_cost       NUMERIC;
  v_compare_label       TEXT;
  v_available           NUMERIC;
  v_batch_label         TEXT;
  v_unit_cost_output    NUMERIC;
  v_output_in_stock     NUMERIC;
  v_output_unit         TEXT;
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

  -- Bulk quantity in the product's stock_unit
  v_bulk_qty := NEW.units_to_package * v_template.bulk_qty_per_unit;
  v_bulk_in_stock := public.qty_to_product_stock_unit(
    v_bulk_qty, v_template.bulk_unit, v_template.finished_product_id
  );
  NEW.bulk_quantity_consumed := v_bulk_in_stock;

  IF NOT pg_try_advisory_xact_lock(hashtext(v_template.finished_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto "%" ocupado en otra transacción, intente de nuevo.',
      v_template.finished_product_name;
  END IF;

  v_available := public.get_stock_balance(v_template.finished_product_id);
  v_compare_label := v_template.finished_product_unit;

  IF v_available < v_bulk_in_stock THEN
    RAISE EXCEPTION 'Stock insuficiente de "%". Requerido: % %, Disponible: % %',
      v_template.finished_product_name,
      ROUND(v_bulk_in_stock, 4),
      v_compare_label,
      ROUND(v_available, 4),
      v_compare_label;
  END IF;

  v_batch_label    := public.next_batch_number('EMP');
  NEW.batch_number := v_batch_label;

  SELECT COALESCE(cost_per_unit, 0) INTO v_bulk_cost_per_unit
  FROM public.products WHERE id = v_template.finished_product_id;

  v_total_cost := v_bulk_in_stock * v_bulk_cost_per_unit;

  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
  VALUES (
    v_template.finished_product_id,
    'EGRESO',
    v_bulk_in_stock,
    v_bulk_cost_per_unit,
    'EMPAQUE',
    NEW.id,
    FORMAT('Empaque %s: %s unidades × %s %s → %s %s',
      v_batch_label, NEW.units_to_package,
      v_template.bulk_qty_per_unit, v_template.bulk_unit,
      ROUND(v_bulk_in_stock, 4), v_compare_label)
  );

  FOR v_material IN
    SELECT
      ptm.material_product_id,
      ptm.quantity_per_unit,
      ptm.unit,
      p.name                       AS material_name,
      p.unit                       AS material_unit,
      COALESCE(p.cost_per_unit, 0) AS cost_per_unit
    FROM public.packaging_template_materials ptm
    JOIN public.products p ON p.id = ptm.material_product_id
    WHERE ptm.template_id = NEW.template_id
  LOOP
    IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
    END IF;

    v_mat_qty      := v_material.quantity_per_unit * NEW.units_to_package;
    v_mat_in_stock := public.qty_to_product_stock_unit(
      v_mat_qty, v_material.unit, v_material.material_product_id
    );

    v_available := public.get_stock_balance(v_material.material_product_id);

    IF v_available < v_mat_in_stock THEN
      RAISE EXCEPTION
        'Stock insuficiente de material "%". Requerido: % %, Disponible: % %',
        v_material.material_name,
        ROUND(v_mat_in_stock, 4), v_material.material_unit,
        ROUND(v_available, 4),   v_material.material_unit;
    END IF;

    v_material_cost := v_mat_in_stock * v_material.cost_per_unit;
    v_total_cost    := v_total_cost + v_material_cost;

    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
    VALUES (
      v_material.material_product_id,
      'EGRESO',
      v_mat_in_stock,
      v_material.cost_per_unit,
      'EMPAQUE',
      NEW.id,
      FORMAT('Material empaque %s: %s × %s %s → %s %s',
        v_batch_label, NEW.units_to_package,
        v_material.quantity_per_unit, v_material.unit,
        ROUND(v_mat_in_stock, 4), v_material.material_unit)
    );
  END LOOP;

  v_unit_cost_output := CASE WHEN NEW.units_to_package > 0
    THEN ROUND(v_total_cost / NEW.units_to_package, 4)
    ELSE 0 END;

  IF v_template.output_product_id <> v_template.finished_product_id THEN
    SELECT COALESCE(NULLIF(TRIM(p.unit), ''), v_template.output_unit)
    INTO v_output_unit
    FROM public.products p WHERE p.id = v_template.output_product_id;

    v_output_in_stock := public.qty_to_product_stock_unit(
      NEW.units_to_package, v_template.output_unit, v_template.output_product_id
    );

    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
    VALUES (
      v_template.output_product_id,
      'INGRESO',
      v_output_in_stock,
      v_unit_cost_output,
      'EMPAQUE',
      NEW.id,
      FORMAT('Empaque %s: %s %s producidas — Costo/u: $%s',
        v_batch_label, ROUND(v_output_in_stock, 4), v_output_unit,
        ROUND(v_unit_cost_output, 4))
    );

    UPDATE public.products
    SET cost_per_unit = v_unit_cost_output
    WHERE id = v_template.output_product_id;
  END IF;

  NEW.completed_at := now();
  RETURN NEW;
END;
$$;
