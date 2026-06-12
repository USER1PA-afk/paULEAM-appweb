-- PAuleam ERP — Migración: Agregar min_stock_alert a stock_summary
-- Necesario para que el frontend pueda comparar stock contra el umbral configurado
-- sin depender de un valor hardcodeado.

DROP VIEW IF EXISTS public.stock_summary CASCADE;

CREATE VIEW public.stock_summary AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.type,
  p.unit,
  p.price,
  p.image_url,
  p.featured,
  p.is_active,
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
  public.get_stock_balance(p.id) AS stock_actual,
  public.get_available_stock(p.id) AS stock_available
FROM public.products p
WHERE p.is_active = TRUE;

GRANT SELECT ON public.stock_summary TO authenticated, anon;
