-- ============================================================
-- PAuleam ERP — Migración: Añadir is_optional a ingredientes
-- ============================================================

ALTER TABLE public.recipe_ingredients
ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT FALSE;
