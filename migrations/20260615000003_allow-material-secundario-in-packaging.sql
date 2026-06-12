-- ============================================================
-- PAuleam ERP — Migración: Permitir MATERIAL_SECUNDARIO como material de empaque
-- ============================================================
-- Amplía el trigger trg_enforce_packaging_material para aceptar
-- tanto ENVASE_EMPAQUE como MATERIAL_SECUNDARIO (etiquetas, cajas, etc.)
-- como materiales válidos en packaging_template_materials.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_packaging_material_type()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  SELECT type INTO v_type FROM public.products WHERE id = NEW.material_product_id;

  IF v_type NOT IN ('ENVASE_EMPAQUE', 'MATERIAL_SECUNDARIO') THEN
    RAISE EXCEPTION
      'El material de empaque debe ser de tipo ENVASE_EMPAQUE o MATERIAL_SECUNDARIO. Tipo recibido: %',
      v_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
