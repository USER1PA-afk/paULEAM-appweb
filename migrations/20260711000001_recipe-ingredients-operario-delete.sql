-- ============================================================
-- PAuleam ERP — Fix: allow operario to DELETE recipe_ingredients
-- ============================================================
-- Root cause of duplicate-ingredient bug:
--   Migration 20260711000000 opened INSERT and UPDATE on
--   recipe_ingredients to operario, but intentionally left
--   DELETE as admin-only. This caused replaceIngredients()
--   to silently skip the DELETE (RLS filtered 0 rows, no error),
--   then INSERT a new batch on top of the existing rows —
--   producing one extra set of duplicates on every save.
--
-- Fix: extend the DELETE policy to include operario, consistent
--   with INSERT and UPDATE permissions granted in the same migration.
--   Hard-deletes (via the UI approval workflow) are already gated
--   at the application level; this policy only affects the
--   replace-all-ingredients pattern inside the recipe editor.
-- ============================================================

DROP POLICY IF EXISTS "ingredients_delete_admin" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "ingredients_delete_staff" ON public.recipe_ingredients;

CREATE POLICY "ingredients_delete_staff"
  ON public.recipe_ingredients FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));
