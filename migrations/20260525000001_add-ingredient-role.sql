-- ============================================================
-- PAuleam ERP — Migración: Rol de ingrediente en recetas
-- ============================================================
-- Añade ingredient_role a recipe_ingredients.
-- Los registros existentes toman MATERIA_PRIMA por defecto.
-- Constraint: solo MATERIA_PRIMA e INSUMO pueden ser ingredientes.
-- ENVASE_EMPAQUE se consume en el módulo de empaque, no en recetas.
-- ============================================================

-- 1. Columna ingredient_role
ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS ingredient_role TEXT NOT NULL DEFAULT 'MATERIA_PRIMA'
    CONSTRAINT recipe_ingredients_role_check
    CHECK (ingredient_role IN ('MATERIA_PRIMA', 'INSUMO'));

-- 2. Columna notes (observaciones de preparación del ingrediente)
ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Índice para filtrar ingredientes por rol en reportes
CREATE INDEX IF NOT EXISTS idx_ingredients_role
  ON public.recipe_ingredients(recipe_id, ingredient_role);

-- 4. Trigger: impedir que ENVASE_EMPAQUE sea ingrediente de receta
CREATE OR REPLACE FUNCTION public.prevent_packaging_as_ingredient()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  SELECT type INTO v_type
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_type = 'ENVASE_EMPAQUE' THEN
    RAISE EXCEPTION
      'Los productos de tipo ENVASE_EMPAQUE no pueden ser ingredientes de receta. '
      'Utilice el módulo de Empaque para consumirlos.';
  END IF;

  IF v_type = 'PRODUCTO_TERMINADO' THEN
    RAISE EXCEPTION
      'Un PRODUCTO_TERMINADO no puede ser ingrediente de una receta.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_packaging_ingredient ON public.recipe_ingredients;
CREATE TRIGGER trg_prevent_packaging_ingredient
  BEFORE INSERT OR UPDATE ON public.recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_packaging_as_ingredient();
