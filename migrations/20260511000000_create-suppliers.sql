-- ============================================================
-- PAuleam ERP — Migración 004: Proveedores
-- ============================================================
-- Tablas: suppliers, product_suppliers
-- Columna: inventory_ledger.supplier_id
-- RLS: admin CRUD, operario SELECT
-- ============================================================

-- ============================
-- 1. PROVEEDORES
-- ============================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                   -- Nombre del contacto
  company     TEXT,                            -- Razón social / empresa
  ruc         TEXT,                            -- RUC / cédula tributaria
  email       TEXT,                            -- Correo de contacto (no es login)
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_ruc    ON public.suppliers(ruc);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================
-- 2. RELACIÓN PRODUCTO ↔ PROVEEDOR (N:M)
-- ============================
-- Solo aplica a productos de tipo MATERIA_PRIMA.
-- is_primary = TRUE marca el proveedor preferido.
-- Si un producto tiene un solo proveedor, se marca automáticamente como primario.
CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_supplier UNIQUE (product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product  ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON public.product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_primary  ON public.product_suppliers(product_id, is_primary);

-- Regla: solo puede haber un proveedor primario por producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_per_product
  ON public.product_suppliers(product_id)
  WHERE is_primary = TRUE;

-- ============================
-- 3. AGREGAR supplier_id A inventory_ledger
-- ============================
-- Nullable: movimientos de producción/ajuste no tienen proveedor.
-- Solo movimientos INGRESO con reference_type = 'COMPRA' deben tener supplier_id.
ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_supplier ON public.inventory_ledger(supplier_id);

-- ============================
-- 4. VISTA: ledger enriquecida con proveedor
-- ============================
-- Reemplaza la consulta directa de inventory_ledger con datos de supplier.
CREATE OR REPLACE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  s.company  AS supplier_company,
  s.name     AS supplier_name,
  s.ruc      AS supplier_ruc
FROM public.inventory_ledger il
LEFT JOIN public.suppliers s ON s.id = il.supplier_id;

-- ============================
-- 5. RLS: suppliers
-- ============================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Admin: CRUD total
DROP POLICY IF EXISTS "suppliers_select_staff" ON public.suppliers;
CREATE POLICY "suppliers_select_staff"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "suppliers_insert_admin" ON public.suppliers;
CREATE POLICY "suppliers_insert_admin"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "suppliers_update_admin" ON public.suppliers;
CREATE POLICY "suppliers_update_admin"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "suppliers_delete_admin" ON public.suppliers;
CREATE POLICY "suppliers_delete_admin"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- 6. RLS: product_suppliers
-- ============================
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_suppliers_select_staff" ON public.product_suppliers;
CREATE POLICY "product_suppliers_select_staff"
  ON public.product_suppliers FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

DROP POLICY IF EXISTS "product_suppliers_insert_admin" ON public.product_suppliers;
CREATE POLICY "product_suppliers_insert_admin"
  ON public.product_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "product_suppliers_update_admin" ON public.product_suppliers;
CREATE POLICY "product_suppliers_update_admin"
  ON public.product_suppliers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "product_suppliers_delete_admin" ON public.product_suppliers;
CREATE POLICY "product_suppliers_delete_admin"
  ON public.product_suppliers FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- 7. RLS: inventory_ledger_view
-- ============================
-- Views inherit RLS from base tables; grant SELECT to authenticated role.
GRANT SELECT ON public.inventory_ledger_view TO authenticated;
