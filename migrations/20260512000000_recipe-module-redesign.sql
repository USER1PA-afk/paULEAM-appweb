-- ============================================================
-- PAuleam ERP — Migración: Rediseño Módulo de Recetas
-- ============================================================
-- 1. Eliminar columna is_optional de recipe_ingredients
-- 2. Agregar columna instructions (JSONB) a recipes
-- 3. Agregar columna notes (TEXT) a recipes
-- ============================================================

-- Eliminar is_optional — ya no se usa
ALTER TABLE public.recipe_ingredients DROP COLUMN IF EXISTS is_optional;

-- Instrucciones de preparación como JSONB
-- Formato: [{"step":1,"description":"Calentar leche a 70°C","temperature":"70°C","duration":"10 min"}, ...]
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS instructions JSONB DEFAULT '[]'::jsonb;

-- Notas/observaciones generales de la receta
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS notes TEXT;
