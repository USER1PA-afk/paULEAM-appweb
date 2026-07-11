-- RPC: purge_product — hard delete a product and ALL dependent rows.
-- Intended for pre-delivery test-data cleanup. Admin UI gates this behind
-- a typed-name confirmation; this function trusts the caller.
-- Deletion order respects FK constraints (RESTRICT → must delete children first).
CREATE OR REPLACE FUNCTION public.purge_product(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_template_ids UUID[];
  v_recipe_ids   UUID[];
BEGIN
  -- 1. stock_reservations (ON DELETE CASCADE, explicit for clarity)
  DELETE FROM public.stock_reservations WHERE product_id = p_product_id;

  -- 2. order_items (ON DELETE RESTRICT on products)
  DELETE FROM public.order_items WHERE product_id = p_product_id;

  -- 3. inventory_ledger (ON DELETE RESTRICT on products)
  DELETE FROM public.inventory_ledger WHERE product_id = p_product_id;

  -- 4. recipe_ingredients where this product is an ingredient (ON DELETE RESTRICT)
  DELETE FROM public.recipe_ingredients WHERE product_id = p_product_id;

  -- 5. packaging templates where this product is finished_product or output_product
  SELECT ARRAY_AGG(id) INTO v_template_ids
  FROM public.packaging_templates
  WHERE finished_product_id = p_product_id
     OR output_product_id   = p_product_id;

  IF v_template_ids IS NOT NULL THEN
    DELETE FROM public.packaging_orders
      WHERE template_id = ANY(v_template_ids);
    DELETE FROM public.packaging_template_materials
      WHERE template_id = ANY(v_template_ids);
    DELETE FROM public.packaging_templates
      WHERE id = ANY(v_template_ids);
  END IF;

  -- 6. packaging_template_materials where this product is the material itself
  DELETE FROM public.packaging_template_materials
    WHERE material_product_id = p_product_id;

  -- 7. recipes where this product is the output
  SELECT ARRAY_AGG(id) INTO v_recipe_ids
  FROM public.recipes
  WHERE output_product_id = p_product_id;

  IF v_recipe_ids IS NOT NULL THEN
    DELETE FROM public.production_orders WHERE recipe_id = ANY(v_recipe_ids);
    DELETE FROM public.recipe_ingredients WHERE recipe_id = ANY(v_recipe_ids);
    DELETE FROM public.recipes            WHERE id        = ANY(v_recipe_ids);
  END IF;

  -- 8. supplier links, images, lots, audit trail
  DELETE FROM public.product_suppliers WHERE product_id = p_product_id;
  DELETE FROM public.product_images    WHERE product_id = p_product_id;
  DELETE FROM public.lots              WHERE product_id = p_product_id;
  DELETE FROM public.audit_log
    WHERE entity_type = 'products'
      AND entity_id   = p_product_id;

  -- 9. product row
  DELETE FROM public.products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.purge_product(UUID) TO authenticated;
