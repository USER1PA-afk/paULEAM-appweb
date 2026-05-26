-- ============================================================
-- PAuleam ERP — Migración: Módulo de Empaque
-- ============================================================
-- Tablas: packaging_templates, packaging_template_materials, packaging_orders
-- Trigger atómico: trg_packaging_completion
--   1. EGRESO del producto terminado a granel
--   2. EGRESO de cada material de empaque
--   3. INGRESO del producto empacado (si es producto diferente)
-- ============================================================

-- ============================
-- 1. PLANTILLAS DE EMPAQUE
-- ============================
-- Define cómo empacar un producto terminado:
-- qué presentación genera y cuánto material consume por unidad.
CREATE TABLE IF NOT EXISTS public.packaging_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  finished_product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  -- Si output_product_id = finished_product_id, no hay conversión de producto.
  -- Si son distintos, se genera stock del producto empacado como nuevo SKU.
  output_product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  -- Cuánto del producto a granel consume 1 unidad empacada (ej: 0.5 para 500g)
  bulk_qty_per_unit    NUMERIC(14,4) NOT NULL CHECK (bulk_qty_per_unit > 0),
  bulk_unit            TEXT NOT NULL,   -- unidad del producto a granel (kg, lt, etc.)
  output_unit          TEXT NOT NULL,   -- unidad del producto empacado (ej: "unidad", "paquete")
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
-- Materiales de tipo ENVASE_EMPAQUE que se consumen por cada unidad empacada.
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

-- Trigger: solo ENVASE_EMPAQUE puede ser material de plantilla
CREATE OR REPLACE FUNCTION public.enforce_packaging_material_type()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  SELECT type INTO v_type
  FROM public.products
  WHERE id = NEW.material_product_id;

  IF v_type <> 'ENVASE_EMPAQUE' THEN
    RAISE EXCEPTION
      'El material de empaque debe ser de tipo ENVASE_EMPAQUE. Tipo recibido: %', v_type;
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
  -- Calculado por el trigger: units_to_package × bulk_qty_per_unit
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
-- 4. TRIGGER ATÓMICO DE EMPAQUE
-- ============================
CREATE OR REPLACE FUNCTION public.process_packaging_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_template    RECORD;
  v_material    RECORD;
  v_bulk_qty    NUMERIC;
  v_mat_qty     NUMERIC;
  v_available   NUMERIC;
  v_batch_label TEXT;
BEGIN
  -- Solo actuar al pasar a COMPLETADA
  IF NEW.status <> 'COMPLETADA' OR OLD.status = 'COMPLETADA' THEN
    RETURN NEW;
  END IF;

  -- Auto-generar batch_number si no hay uno
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    NEW.batch_number := 'EMP-' || TO_CHAR(now(), 'YYYY') || '-' ||
                        LPAD(nextval('public.production_batch_seq')::TEXT, 4, '0');
  END IF;
  v_batch_label := NEW.batch_number;

  -- Obtener plantilla con los datos de producto
  SELECT
    pt.*,
    fp.name AS finished_product_name,
    fp.unit AS finished_product_unit,
    op.name AS output_product_name,
    op.type AS output_product_type
  INTO v_template
  FROM public.packaging_templates pt
  JOIN public.products fp ON fp.id = pt.finished_product_id
  JOIN public.products op ON op.id = pt.output_product_id
  WHERE pt.id = NEW.template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla de empaque % no encontrada', NEW.template_id;
  END IF;

  -- Calcular cantidad a granel a consumir
  v_bulk_qty := NEW.units_to_package * v_template.bulk_qty_per_unit;
  NEW.bulk_quantity_consumed := v_bulk_qty;

  -- Bloqueo consultivo sobre el producto a granel
  IF NOT pg_try_advisory_xact_lock(hashtext(v_template.finished_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto "%" ocupado en otra transacción, intente de nuevo.',
      v_template.finished_product_name;
  END IF;

  -- Validar stock del producto a granel
  v_available := public.get_stock_balance(v_template.finished_product_id);
  IF v_available < v_bulk_qty THEN
    RAISE EXCEPTION
      'Stock insuficiente de "%". Requerido: % %s, Disponible: % %s',
      v_template.finished_product_name,
      ROUND(v_bulk_qty, 4), v_template.bulk_unit,
      ROUND(v_available, 4), v_template.bulk_unit;
  END IF;

  -- EGRESO del producto a granel
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_template.finished_product_id,
    'EGRESO',
    v_bulk_qty,
    'EMPAQUE',
    NEW.id,
    FORMAT('Lote %s — Empaque: %s — %s unidades × %s %s/unidad',
      v_batch_label,
      v_template.name,
      NEW.units_to_package,
      v_template.bulk_qty_per_unit,
      v_template.bulk_unit),
    NEW.created_by
  );

  -- Procesar materiales de empaque
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

    -- Bloqueo consultivo sobre el material
    IF NOT pg_try_advisory_xact_lock(hashtext(v_material.material_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Material "%" ocupado, intente de nuevo.', v_material.material_name;
    END IF;

    -- Validar stock del material
    v_available := public.get_stock_balance(v_material.material_product_id);
    IF v_available < v_mat_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente de material "%" para empaque. Requerido: % %s, Disponible: % %s',
        v_material.material_name,
        ROUND(v_mat_qty, 4), v_material.unit,
        ROUND(v_available, 4), v_material.unit;
    END IF;

    -- EGRESO del material
    INSERT INTO public.inventory_ledger (
      product_id, movement_type, quantity,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_material.material_product_id,
      'EGRESO',
      v_mat_qty,
      'EMPAQUE',
      NEW.id,
      FORMAT('Lote %s — Material de empaque: %s',
        v_batch_label, v_template.name),
      NEW.created_by
    );
  END LOOP;

  -- INGRESO del producto empacado
  -- Si el output es diferente al granel, genera stock nuevo
  INSERT INTO public.inventory_ledger (
    product_id, movement_type, quantity,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_template.output_product_id,
    'INGRESO',
    NEW.units_to_package,
    'EMPAQUE',
    NEW.id,
    FORMAT('Lote %s — Empaque completado: %s unidades',
      v_batch_label, NEW.units_to_package),
    NEW.created_by
  );

  NEW.completed_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_packaging_completion
  BEFORE UPDATE ON public.packaging_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_packaging_completion();

-- ============================
-- 5. RLS — PACKAGING TABLES
-- ============================
ALTER TABLE public.packaging_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_template_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_orders ENABLE ROW LEVEL SECURITY;

-- Plantillas: staff puede leer; solo admin puede crear/editar
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

-- Materiales de plantilla
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

-- Órdenes de empaque: staff puede crear/ver/actualizar
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
-- 6. VISTA ENRIQUECIDA DEL LEDGER (ACTUALIZADA)
-- ============================
DROP VIEW IF EXISTS public.inventory_ledger_view;
CREATE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  p.name       AS product_name,
  p.sku        AS product_sku,
  p.unit       AS product_unit,
  p.type       AS product_type,
  -- Proveedor (para movimientos de compra)
  s.company    AS supplier_company,
  s.name       AS supplier_name,
  s.ruc        AS supplier_ruc,
  -- Receta (para movimientos de producción)
  r.name       AS production_recipe_name,
  -- Lote de producción
  po.batch_number AS production_batch_number,
  -- Plantilla de empaque (para movimientos de empaque)
  pt.name      AS packaging_template_name,
  -- Etiqueta legible del reference_type
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
LEFT JOIN public.products p          ON p.id = il.product_id
LEFT JOIN public.suppliers s         ON s.id = il.supplier_id
LEFT JOIN public.production_orders po
  ON po.id = il.reference_id AND il.reference_type = 'PRODUCCION'
LEFT JOIN public.recipes r           ON r.id = po.recipe_id
LEFT JOIN public.packaging_orders pkg_o
  ON pkg_o.id = il.reference_id AND il.reference_type = 'EMPAQUE'
LEFT JOIN public.packaging_templates pt ON pt.id = pkg_o.template_id;

GRANT SELECT ON public.inventory_ledger_view TO authenticated;
