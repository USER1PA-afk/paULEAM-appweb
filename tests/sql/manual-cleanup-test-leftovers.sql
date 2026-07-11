-- ============================================================
-- PAuleam ERP — Manual cleanup of regression test leftovers
-- ============================================================
-- Run this ONCE in the Insforge SQL console to wipe the
-- movements and products the test left behind. After it runs,
-- paste the updated test (tests/sql/inventory-stock-guard.test.sql)
-- and re-run.
-- ============================================================

DO $$
BEGIN
  BEGIN
    DELETE FROM public.inventory_ledger
      WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'inventory_ledger: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.order_items
      WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'order_items: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.orders
      WHERE id NOT IN (SELECT DISTINCT order_id FROM public.order_items);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'orphan orders: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.recipe_ingredients
      WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'recipe_ingredients: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.recipe_ingredients
      WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'recipe_ingredients by product: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.production_orders
      WHERE recipe_id IN (SELECT id FROM public.recipes WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'production_orders: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.recipes WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'recipes: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.packaging_template_materials
      WHERE material_product_id IN (SELECT id FROM public.products WHERE sku LIKE '__TEST_%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'packaging_template_materials: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.packaging_orders
      WHERE template_id IN (SELECT id FROM public.packaging_templates WHERE name LIKE '__test%');
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'packaging_orders: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.packaging_templates WHERE name LIKE '__test%';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'packaging_templates: %', SQLERRM; END;

  BEGIN
    DELETE FROM public.products WHERE sku LIKE '__TEST_%';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'products: %', SQLERRM; END;
END;
$$;
