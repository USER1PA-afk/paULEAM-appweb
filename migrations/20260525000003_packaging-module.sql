-- ============================================================
-- PAuleam ERP — Migración: Módulo de Empaque
-- ============================================================
-- Tablas: packaging_templates, packaging_template_materials, packaging_orders
-- Helpers:
--   unit_to_kg_factor()     — convierte cualquier unidad a factor kg
-- Trigger atómico: fn_packaging_completion
--   1. EGRESO del producto a granel (convertido a kg)
--   2. EGRESO de cada material de empaque
--   3. INGRESO del producto empacado
-- ============================================================

-- ============================
-- 1. PLANTILLAS DE EMPAQUE
-- ============================
CREATE TABLE IF NOT EXISTS public.packaging_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  finished_product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  output_product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  bulk_qty_per_unit    NUMERIC(14,4) NOT NULL CHECK (bulk_qty_per_unit > 0),
  bulk_unit            TEXT NOT NULL,
  output_unit          TEXT NOT NULL,
  description          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packaging_templates_product
  ON public.packaging_templates(finished_product_id);

-- ============================
-- 2. MATERIALES POR PLANTILLA
-- ============================
CREATE TABLE IF NOT EXISTS public.packaging_template_materials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES public.packaging_templates(id) ON DELETE CASCADE,
  material_product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_per_unit     NUMERIC(14,4) NOT NULL CHECK (quantity_per_unit > 0),
  unit                  TEXT NOT NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_material UNIQUE (template_id, material_product_id)
);

CREATE INDEX IF NOT EXISTS idx_template_materials_template
  ON public.packaging_template_materials(template_id);

-- Solo ENVASE_EMPAQUE puede ser material de plantilla
CREATE OR REPLACE FUNCTION public.enforce_packaging_material_type()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  SELECT type INTO v_type FROM public.products WHERE id = NEW.material_product_id;
  IF v_type <> 'ENVASE_EMPAQUE' THEN
    RAISE EXCEPTION 'El material de empaque debe ser de tipo ENVASE_EMPAQUE. Tipo recibido: %', v_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_packaging_material ON public.packaging_template_materials;
CREATE TRIGGER trg_enforce_packaging_material
  BEFORE INSERT OR UPDATE ON public.packaging_template_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_packaging_material_type();

-- ============================
-- 3. ÓRDENES DE EMPAQUE
-- ============================
DO $$ BEGIN
  CREATE TYPE public.packaging_status AS ENUM ('BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.packaging_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id             UUID NOT NULL REFERENCES public.packaging_templates(id) ON DELETE RESTRICT,
  production_order_id     UUID REFERENCES public.production_orders(id) ON DELETE SET NULL,
  units_to_package        NUMERIC(14,4) NOT NULL CHECK (units_to_package > 0),
  bulk_quantity_consumed  NUMERIC(14,4),
  status                  public.packaging_status NOT NULL DEFAULT 'BORRADOR',
  batch_number            TEXT,
  notes                   TEXT,
  completed_at            TIMESTAMPTZ,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packaging_orders_template
  ON public.packaging_orders(template_id);
CREATE INDEX IF NOT EXISTS idx_packaging_orders_status
  ON public.packaging_orders(status);
CREATE INDEX IF NOT EXISTS idx_packaging_orders_production
  ON public.packaging_orders(production_order_id)
  WHERE production_order_id IS NOT NULL;

CREATE TRIGGER set_packaging_orders_updated_at
  BEFORE UPDATE ON public.packaging_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================
-- 4. HELPER: CONVERSIÓN A KG
-- ============================
-- Devuelve cuántos kg equivale 1 unidad de p_unit.
-- Para unidades discretas (unidad, pza) devuelve 1 para operar directo.
CREATE OR REPLACE FUNCTION public.unit_to_kg_factor(p_unit TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE lower(trim(p_unit))
    WHEN 'kg'      THEN RETURN 1;
    WHEN 'kilo'    THEN RETURN 1;
    WHEN 'kilos'   THEN RETURN 1;
    WHEN 'g'       THEN RETURN 0.001;
    WHEN 'gs'      THEN RETURN 0.001;
    WHEN 'gr'      THEN RETURN 0.001;
    WHEN 'gramo'   THEN RETURN 0.001;
    WHEN 'gramos'  THEN RETURN 0.001;
    WHEN 'mg'      THEN RETURN 0.000001;
    WHEN 'lb'      THEN RETURN 0.453592;
    WHEN 'libra'   THEN RETURN 0.453592;
    WHEN 'libras'  THEN RETURN 0.453592;
    WHEN 'oz'      THEN RETURN 0.0283495;
    WHEN 'l'       THEN RETURN 1;
    WHEN 'lt'      THEN RETURN 1;
    WHEN 'litro'   THEN RETURN 1;
    WHEN 'litros'  THEN RETURN 1;
    WHEN 'ml'      THEN RETURN 0.001;
    ELSE RETURN 1;
  END CASE;
END;
$$;

-- ============================
-- 5. TRIGGER ATÓMICO DE EMPAQUE (versión final con conversión de unidades)
-- ============================
CREATE OR REPLACE FUNCTION public.fn_packaging_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template     RECORD;
  v_material     RECORD;
  v_bulk_qty     NUMERIC;
  v_bulk_kg      NUMERIC;
  v_mat_qty      NUMERIC;
  v_available    NUMERIC;
  v_batch_label  TEXT;
  v_bulk_factor  NUMERIC;
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

  INSERT INTO public.inventory_ledger
    (product_id, movement_type, quantity, reference_type, reference_id, notes)
  VALUES (
    v_template.finished_product_id,
    'EGRESO',
    v_bulk_kg,
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
      p.name AS material_name
    FROM public.packaging_template_materials ptm
    JOIN public.products p ON p.id = ptm.material_product_id
    WHERE ptm.template_id = NEW.template_id
  LOOP
    v_mat_qty := v_material.quantity_per_unit * NEW.units_to_package;

    IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
    END IF;

    v_available := public.get_stock_balance(v_material.material_product_id);

    DECLARE
      v_compare_qty   NUMERIC;
      v_compare_label TEXT;
    BEGIN
      IF lower(trim(v_material.unit)) IN
         ('unidad','unidades','ud','uds','pza','pieza','piezas','u') THEN
        v_compare_qty   := v_mat_qty;
        v_compare_label := v_material.unit;
      ELSE
        v_compare_qty   := v_mat_qty * public.unit_to_kg_factor(v_material.unit);
        v_compare_label := 'kg';
      END IF;

      IF v_available < v_compare_qty THEN
        RAISE EXCEPTION
          'Stock insuficiente de material "%". Requerido: % %, Disponible: % %',
          v_material.material_name,
          ROUND(v_compare_qty, 4), v_compare_label,
          ROUND(v_available, 4),   v_compare_label;
      END IF;

      INSERT INTO public.inventory_ledger
        (product_id, movement_type, quantity, reference_type, reference_id, notes)
      VALUES (
        v_material.material_product_id,
        'EGRESO',
        v_compare_qty,
        'EMPAQUE',
        NEW.id,
        FORMAT('Material empaque %s: %s × %s %s',
          v_batch_label, NEW.units_to_package,
          v_material.quantity_per_unit, v_material.unit)
      );
    END;
  END LOOP;

  IF v_template.output_product_id <> v_template.finished_product_id THEN
    INSERT INTO public.inventory_ledger
      (product_id, movement_type, quantity, reference_type, reference_id, notes)
    VALUES (
      v_template.output_product_id,
      'INGRESO',
      NEW.units_to_package,
      'EMPAQUE',
      NEW.id,
      FORMAT('Empaque %s: %s %s producidas',
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
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_packaging_completion();

-- ============================
-- 6. RLS
-- ============================
ALTER TABLE public.packaging_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_template_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_orders             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pkg_templates_select_staff"
  ON public.packaging_templates FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "pkg_templates_insert_admin"
  ON public.packaging_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "pkg_templates_update_admin"
  ON public.packaging_templates FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "pkg_materials_select_staff"
  ON public.packaging_template_materials FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "pkg_materials_insert_admin"
  ON public.packaging_template_materials FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "pkg_materials_update_admin"
  ON public.packaging_template_materials FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "pkg_materials_delete_admin"
  ON public.packaging_template_materials FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "pkg_orders_select_staff"
  ON public.packaging_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "pkg_orders_insert_staff"
  ON public.packaging_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "pkg_orders_update_staff"
  ON public.packaging_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- ============================
-- 7. VISTA ENRIQUECIDA DEL LEDGER (incluye empaque)
-- ============================
DROP VIEW IF EXISTS public.inventory_ledger_view;
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
  pt.name      AS packaging_template_name,
  CASE il.reference_type
    WHEN 'COMPRA'     THEN 'Compra / Recepción'
    WHEN 'PRODUCCION' THEN 'Producción'
    WHEN 'EMPAQUE'    THEN 'Empaque'
    WHEN 'VENTA'      THEN 'Venta'
    WHEN 'AJUSTE'     THEN 'Ajuste'
    WHEN 'MERMA'      THEN 'Merma / Pérdida'
    WHEN 'DEVOLUCION' THEN 'Devolución'
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
LEFT JOIN public.packaging_templates pt ON pt.id = pkg_o.template_id;

GRANT SELECT ON public.inventory_ledger_view TO authenticated;
