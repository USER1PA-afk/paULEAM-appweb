-- ============================================================
-- PAuleam ERP — Fix: Re-backfill recipe_ingredients.percentage
-- con conversión de unidades correcta
-- ============================================================
-- PROBLEMA: La migración 20260712000000 calculó:
--   percentage = (quantity / yield_base) * 100
-- sin convertir unidades. Si quantity está en gramos y yield_base
-- en kg (o viceversa), el porcentaje queda inflado/desinflado por
-- un factor de 1000, haciendo que la suma supere el 100% esperado.
--
-- SOLUCIÓN: Convertir quantity a la misma unidad base que yield_base
-- usando unit_to_kg_factor() antes de dividir.
--
-- La función unit_to_kg_factor() ya existe en el schema público
-- (creada por 20260712000000).
-- ============================================================

-- Paso 1: Reset de todos los porcentajes calculados automáticamente
-- (solo los que YA existen; las filas ingresadas manualmente conservan
-- su valor si percentage ya era correcto).
-- Hacemos reset de TODOS para recalcular correctamente.
UPDATE public.recipe_ingredients
SET percentage = NULL
WHERE percentage IS NOT NULL;

-- Paso 2: Re-backfill con conversión de unidades
-- Lógica:
--   a) Convertir ri.quantity a kg:       qty_kg   = ri.quantity  * unit_to_kg_factor(ri.unit)
--   b) Convertir r.yield_base a kg:      base_kg  = r.yield_base * unit_to_kg_factor(r.yield_unit)
--   c) percentage = (qty_kg / base_kg) * 100
--
-- Solo filas donde base_kg > 0 (evita división por cero).
UPDATE public.recipe_ingredients ri
SET    percentage = ROUND(
         (
           (ri.quantity  * public.unit_to_kg_factor(ri.unit))
           /
           (r.yield_base * public.unit_to_kg_factor(r.yield_unit))
         ) * 100.0,
         4
       )
FROM   public.recipes r
WHERE  ri.recipe_id = r.id
  AND  ri.percentage IS NULL
  AND  (r.yield_base * public.unit_to_kg_factor(r.yield_unit)) > 0;
