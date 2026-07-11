-- RPC: archive a product atomically, optionally replacing it in all recipe_ingredients first.
-- p_replacement_product_id = NULL  →  skip/confirm path (archive only, keep historical refs)
-- p_replacement_product_id = <id>  →  replace path (swap ingredient refs, then archive)
CREATE OR REPLACE FUNCTION archive_product_with_replacement(
  p_product_id_to_archive  UUID,
  p_replacement_product_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_replacement_product_id IS NOT NULL THEN
    UPDATE recipe_ingredients
       SET product_id = p_replacement_product_id
     WHERE product_id = p_product_id_to_archive;
  END IF;

  UPDATE products
     SET is_active = FALSE
   WHERE id = p_product_id_to_archive;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
