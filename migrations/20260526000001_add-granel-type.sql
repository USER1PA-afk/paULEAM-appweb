-- ============================================================
-- PAuleam ERP — Migración: Añadir tipo PRODUCTO_A_GRANEL
-- Parte 1/2 — Solo el ADD VALUE (requiere commit propio).
-- Depende de 20260525000000 (enum base ya committed).
-- ============================================================

-- Añadir el nuevo valor al enum de tipos de producto.
-- PRODUCTO_A_GRANEL representa el producto resultante de la producción
-- (ej. queso fresco a granel en kg) antes de ser envasado.
-- Flujo: MATERIA_PRIMA + INSUMO → (producción) → PRODUCTO_A_GRANEL → (empaque) → PRODUCTO_TERMINADO

ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'PRODUCTO_A_GRANEL';
