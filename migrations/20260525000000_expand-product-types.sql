-- ============================================================
-- PAuleam ERP — Migración: Ampliar taxonomía de tipos de producto (Parte 1/2)
-- Añade los nuevos valores al ENUM en su propia transacción.
-- Los nuevos valores deben ser COMMITTED antes de poder ser usados.
-- ============================================================

ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'INSUMO';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'ENVASE_EMPAQUE';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'OTRO';
