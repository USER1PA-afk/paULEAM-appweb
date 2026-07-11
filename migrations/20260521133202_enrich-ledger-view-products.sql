-- ============================================================
-- PAuleam ERP — Migración: Enriquecer inventory_ledger_view
-- ============================================================
-- Agrega columnas de producto (name, sku, unit) y nombre de receta
-- de producción para permitir agrupamiento en el frontend.
-- ============================================================

CREATE OR REPLACE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  s.company  AS supplier_company,
  s.name     AS supplier_name,
  s.ruc      AS supplier_ruc,
  p.name     AS product_name,
  p.sku      AS product_sku,
  p.unit     AS product_unit,
  r.name     AS production_recipe_name
FROM public.inventory_ledger il
LEFT JOIN public.suppliers s ON s.id = il.supplier_id
LEFT JOIN public.products p ON p.id = il.product_id
LEFT JOIN public.production_orders po
  ON po.id = il.reference_id AND il.reference_type = 'PRODUCCION'
LEFT JOIN public.recipes r ON r.id = po.recipe_id;

-- Views inherit RLS from base tables; re-grant SELECT.
GRANT SELECT ON public.inventory_ledger_view TO authenticated;
