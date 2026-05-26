-- ============================================================
-- PAuleam ERP — Migración: Campo capacity en products
-- Almacena la capacidad del envase (para ENVASE_EMPAQUE).
-- ej: 500 g, 1 lt, 250 ml
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS capacity NUMERIC(14,4);

COMMENT ON COLUMN public.products.capacity IS
  'Capacidad del envase/empaque (ej: 500 para 500g). Aplica a tipo ENVASE_EMPAQUE.';
