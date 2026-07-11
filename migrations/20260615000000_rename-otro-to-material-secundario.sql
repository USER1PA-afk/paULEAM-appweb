-- ============================================================
-- PAuleam ERP — Migración 1/2: Agrega valor al enum product_type
-- DEBE ejecutarse en su propia transacción (sola en este archivo).
-- La migración siguiente (000001) usa el nuevo valor.
-- ============================================================

ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'MATERIAL_SECUNDARIO';
