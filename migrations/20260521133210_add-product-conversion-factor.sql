-- ============================================================
-- PAuleam ERP — Migración: Conversión de Unidades de Medida
-- ============================================================
-- Agrega columnas de factor de conversión y unidad de venta
-- a la tabla de productos, actualiza los productos existentes
-- (pastel de chocolate y Queso de ajojonli), y redefine la vista
-- stock_summary para incluir stock_available y detalles e-commerce.
-- ============================================================

-- 1. Alterar tabla de productos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS conversion_factor DOUBLE PRECISION DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS sales_unit_name TEXT DEFAULT NULL;

-- 2. Actualizar productos terminados existentes con sus factores comerciales
-- Pastel de chocolate: 1 kg ≈ 2.20462 Libras (1 Unidad = 1 Libra)
UPDATE public.products
SET conversion_factor = 2.20462, sales_unit_name = 'Libra'
WHERE name = 'pastel de chocolate';

-- Queso de ajonjolí: 1 kg ≈ 2.0 Unidades
UPDATE public.products
SET conversion_factor = 2.0, sales_unit_name = 'Unidad'
WHERE name = 'Queso de ajojonli';

-- 3. Redefinir la vista stock_summary
-- Primero eliminamos la vista existente para evitar errores de reordenación de columnas en Postgres
DROP VIEW IF EXISTS public.stock_summary CASCADE;

CREATE VIEW public.stock_summary AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.type,
  p.unit,
  p.price,
  p.image_url,
  p.featured,
  p.is_active,
  p.description,
  p.short_description,
  p.long_description,
  p.specifications,
  p.ingredients,
  p.nutritional_info,
  p.weight,
  p.commercial_details,
  p.conversion_factor,
  p.sales_unit_name,
  public.get_stock_balance(p.id) AS stock_actual,
  public.get_available_stock(p.id) AS stock_available
FROM public.products p
WHERE p.is_active = TRUE;

-- 4. Otorgar permisos sobre la vista
GRANT SELECT ON public.stock_summary TO authenticated, anon;
