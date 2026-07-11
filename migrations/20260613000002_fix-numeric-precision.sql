-- PAuleam ERP — Migración: Corrección de tipos numéricos
-- Problema 1: conversion_factor era DOUBLE PRECISION → NUMERIC(10,6)
-- Problema 2: unit_cost era NUMERIC(12,2) → NUMERIC(12,4)
-- Ambas columnas son referenciadas por vistas, por lo que se deben
-- eliminar, alterar y recrear.

-- ============================================================
-- 1. Eliminar vistas que dependen de las columnas a alterar
-- ============================================================

-- stock_summary depende de products.conversion_factor
DROP VIEW IF EXISTS public.stock_summary CASCADE;

-- inventory_ledger_view depende de inventory_ledger.unit_cost (via il.*)
DROP VIEW IF EXISTS public.inventory_ledger_view CASCADE;

-- ============================================================
-- 2. Alterar columnas
-- ============================================================

ALTER TABLE public.products
  ALTER COLUMN conversion_factor TYPE NUMERIC(10,6)
  USING conversion_factor::NUMERIC(10,6);

ALTER TABLE public.inventory_ledger
  ALTER COLUMN unit_cost TYPE NUMERIC(12,4)
  USING unit_cost::NUMERIC(12,4);

-- ============================================================
-- 3. Recrear inventory_ledger_view (última versión: packaging-module)
-- ============================================================

CREATE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  p.name       AS product_name,
  p.sku        AS product_sku,
  p.unit       AS product_unit,
  p.type       AS product_type,
  s.company    AS supplier_company,
  s.name       AS supplier_name,
  s.ruc        AS supplier_ruc,
  r.name       AS production_recipe_name,
  po.batch_number AS production_batch_number,
  pt.name      AS packaging_template_name,
  CASE il.reference_type
    WHEN 'COMPRA'     THEN 'Compra / Recepción'
    WHEN 'PRODUCCION' THEN 'Producción'
    WHEN 'EMPAQUE'    THEN 'Empaque'
    WHEN 'VENTA'      THEN 'Venta'
    WHEN 'AJUSTE'     THEN 'Ajuste'
    WHEN 'MERMA'      THEN 'Merma / Pérdida'
    WHEN 'DEVOLUCION' THEN 'Devolución'
    ELSE COALESCE(il.reference_type, '—')
  END AS reference_type_label
FROM public.inventory_ledger il
LEFT JOIN public.products p ON p.id = il.product_id
LEFT JOIN public.suppliers s ON s.id = il.supplier_id
LEFT JOIN public.production_orders po
  ON po.id = il.reference_id AND il.reference_type = 'PRODUCCION'
LEFT JOIN public.recipes r ON r.id = po.recipe_id
LEFT JOIN public.packaging_orders pkg_o
  ON pkg_o.id = il.reference_id AND il.reference_type = 'EMPAQUE'
LEFT JOIN public.packaging_templates pt ON pt.id = pkg_o.template_id;

GRANT SELECT ON public.inventory_ledger_view TO authenticated;

-- ============================================================
-- 4. Recrear stock_summary (última versión: 20260613000001)
-- ============================================================

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
