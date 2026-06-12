-- ============================================================
-- PAuleam ERP — Migración: Separar unit (inventario) de capacity_unit (envase)
-- ============================================================
-- Para ENVASE_EMPAQUE el campo products.unit almacenaba la unidad de
-- capacidad del envase (g, kg, lb, ml…) en lugar de la unidad de
-- inventario físico ("unidades").  Esto causaba que el stock_summary
-- mostrara "200 lb" en vez de "200 unidades".
--
-- Corrección:
--   1. Añadir columna capacity_unit TEXT (nullable).
--   2. Para ENVASE_EMPAQUE existentes: mover unit → capacity_unit, fijar unit = 'unidades'.
--   3. Para nuevos productos ENVASE_EMPAQUE el formulario enviará unit='unidades'
--      y capacity_unit=<unidad de contenido>.
-- ============================================================

-- 1. Agregar columna
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS capacity_unit TEXT;

COMMENT ON COLUMN public.products.capacity_unit IS
  'Unidad de medida del contenido del envase (g, kg, ml, lb…). Solo aplica a ENVASE_EMPAQUE.';

-- 2. Migrar filas existentes de ENVASE_EMPAQUE
UPDATE public.products
SET
  capacity_unit = unit,
  unit          = 'unidades'
WHERE type = 'ENVASE_EMPAQUE'
  AND unit <> 'unidades';  -- idempotente: no re-procesar si ya fue migrado
