-- Rebuild stock_summary to include capacity_unit and show_in_pos
DROP VIEW IF EXISTS public.stock_summary CASCADE;

CREATE VIEW public.stock_summary AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.type,
  p.unit,
  p.capacity_unit,
  p.price,
  p.image_url,
  p.featured,
  p.is_active,
  p.show_in_pos,
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
  p.min_stock_alert,
  public.get_stock_balance(p.id)   AS stock_actual,
  public.get_available_stock(p.id) AS stock_available
FROM public.products p
WHERE p.is_active = TRUE;

GRANT SELECT ON public.stock_summary TO authenticated, anon;
