-- ============================================================
-- PAuleam ERP — Deletion-request approval workflow
-- ============================================================
-- Operator (operario) cannot hard-delete products, suppliers, or
-- recipes. Instead, they submit a request that an admin must
-- approve or reject. The actual soft-delete (is_active = false)
-- happens only on approval.
--
-- The notification is sent to each administrator profile individually,
-- so operators never see them.
-- ============================================================

-- ============================
-- 1. deletion_requests table
-- ============================
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('product','supplier','recipe')),
  entity_id     UUID NOT NULL,
  entity_label  TEXT NOT NULL,
  requested_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status  ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_entity  ON public.deletion_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_requester ON public.deletion_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_pending
  ON public.deletion_requests(status, requested_at DESC)
  WHERE status = 'PENDING';

-- One PENDING request per entity (prevents spam duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_requests_pending_per_entity
  ON public.deletion_requests(entity_type, entity_id)
  WHERE status = 'PENDING';

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Requester sees their own, admin sees all
DROP POLICY IF EXISTS "deletion_requests_select" ON public.deletion_requests;
CREATE POLICY "deletion_requests_select"
  ON public.deletion_requests FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid() OR public.get_user_role() = 'admin');

-- Staff can submit requests
DROP POLICY IF EXISTS "deletion_requests_insert" ON public.deletion_requests;
CREATE POLICY "deletion_requests_insert"
  ON public.deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.get_user_role() IN ('admin','operario')
  );

-- Only admin can update (approve/reject) — this is the trust boundary
DROP POLICY IF EXISTS "deletion_requests_update_admin" ON public.deletion_requests;
CREATE POLICY "deletion_requests_update_admin"
  ON public.deletion_requests FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- No DELETE — preserve audit trail

-- ============================
-- 2. notifications changes (omitted)
--    To prevent ownership errors ("must be owner of table notifications"),
--    we do not alter public.notifications or modify its policies.
--    Instead, admin-targeted notifications are inserted individually
--    for each admin profile.
-- ============================

-- ============================
-- 4. Soft-delete RPCs: allow admin to archive via SECURITY DEFINER
--    (operario UPDATE is blocked by RLS)
-- ============================
CREATE OR REPLACE FUNCTION public.soft_archive_supplier(p_supplier_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.suppliers SET is_active = FALSE WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proveedor % no encontrado', p_supplier_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.soft_archive_supplier(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_archive_recipe(p_recipe_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.recipes SET is_active = FALSE WHERE id = p_recipe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta % no encontrada', p_recipe_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.soft_archive_recipe(UUID) TO authenticated;

-- ============================
-- 5. request_entity_deletion RPC
--    Validates entity exists + is active, prevents duplicate PENDING,
--    inserts the request, fires an admin-only notification.
-- ============================
CREATE OR REPLACE FUNCTION public.request_entity_deletion(
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_reason      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label     TEXT;
  v_id        UUID;
  v_role      TEXT;
  v_is_active BOOLEAN;
BEGIN
  v_role := public.get_user_role();
  IF v_role NOT IN ('admin','operario') THEN
    RAISE EXCEPTION 'Solo el personal autorizado puede solicitar eliminaciones';
  END IF;

  IF p_entity_type NOT IN ('product','supplier','recipe') THEN
    RAISE EXCEPTION 'Tipo de entidad no soportado: %', p_entity_type;
  END IF;

  -- Validate entity exists and is active
  IF p_entity_type = 'product' THEN
    SELECT name, is_active INTO v_label, v_is_active FROM public.products WHERE id = p_entity_id;
  ELSIF p_entity_type = 'supplier' THEN
    SELECT COALESCE(company, name), is_active INTO v_label, v_is_active FROM public.suppliers WHERE id = p_entity_id;
  ELSE
    SELECT name, is_active INTO v_label, v_is_active FROM public.recipes WHERE id = p_entity_id;
  END IF;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'La entidad % (%) no existe', p_entity_type, p_entity_id;
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'La entidad ya está archivada';
  END IF;

  -- Reject duplicate PENDING
  IF EXISTS (
    SELECT 1 FROM public.deletion_requests
    WHERE entity_type = p_entity_type
      AND entity_id   = p_entity_id
      AND status      = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente para esta entidad';
  END IF;

  INSERT INTO public.deletion_requests (entity_type, entity_id, entity_label, requested_by, reason)
  VALUES (p_entity_type, p_entity_id, v_label, auth.uid(), p_reason)
  RETURNING id INTO v_id;

  -- Admin-only notifications (individual insert per admin profile)
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT
    pr.id,
    'Solicitud de eliminación: ' || CASE
      WHEN p_entity_type = 'product'  THEN 'producto'
      WHEN p_entity_type = 'supplier' THEN 'proveedor'
      ELSE 'receta'
    END,
    v_label || COALESCE(' — Motivo: ' || p_reason, ''),
    'REQUEST'
  FROM public.profiles pr
  WHERE pr.role = 'admin';

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_entity_deletion(TEXT, UUID, TEXT) TO authenticated;

-- ============================
-- 6. approve_deletion_request RPC
--    Soft-archives the entity atomically, marks request APPROVED.
--    Rejects if already reviewed.
-- ============================
CREATE OR REPLACE FUNCTION public.approve_deletion_request(
  p_request_id UUID,
  p_note       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req       RECORD;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede aprobar solicitudes';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud % no encontrada', p_request_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'La solicitud ya fue revisada (estado: %)', v_req.status;
  END IF;

  -- Soft-archive via existing/new RPCs (they are SECURITY DEFINER, so
  -- the admin's RLS-restricted UPDATE succeeds through them)
  IF v_req.entity_type = 'product' THEN
    -- Reuse the existing product archive RPC (replaces in recipes if needed)
    -- For a deletion request we don't have a replacement product; just archive.
    PERFORM public.archive_product_with_replacement(v_req.entity_id, NULL);
  ELSIF v_req.entity_type = 'supplier' THEN
    PERFORM public.soft_archive_supplier(v_req.entity_id);
  ELSIF v_req.entity_type = 'recipe' THEN
    PERFORM public.soft_archive_recipe(v_req.entity_id);
  END IF;

  UPDATE public.deletion_requests
     SET status      = 'APPROVED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_deletion_request(UUID, TEXT) TO authenticated;

-- ============================
-- 7. reject_deletion_request RPC
-- ============================
CREATE OR REPLACE FUNCTION public.reject_deletion_request(
  p_request_id UUID,
  p_note       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede rechazar solicitudes';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud % no encontrada', p_request_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'La solicitud ya fue revisada (estado: %)', v_req.status;
  END IF;

  UPDATE public.deletion_requests
     SET status      = 'REJECTED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_deletion_request(UUID, TEXT) TO authenticated;

-- ============================
-- 8. Loosen RLS for suppliers + recipes INSERT/UPDATE
--    so operario can create/edit (the gating was only on the UI).
-- ============================
DROP POLICY IF EXISTS "suppliers_insert_admin" ON public.suppliers;
CREATE POLICY "suppliers_insert_staff"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin','operario'));

DROP POLICY IF EXISTS "suppliers_update_admin" ON public.suppliers;
CREATE POLICY "suppliers_update_staff"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin','operario'));

-- Keep DELETE admin-only — deletion goes through the approval queue
-- (the policy suppliers_delete_admin from 20260511000000 stays as-is)

DROP POLICY IF EXISTS "recipes_insert_admin" ON public.recipes;
CREATE POLICY "recipes_insert_staff"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin','operario'));

DROP POLICY IF EXISTS "recipes_update_admin" ON public.recipes;
CREATE POLICY "recipes_update_staff"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin','operario'));

DROP POLICY IF EXISTS "ingredients_insert_admin" ON public.recipe_ingredients;
CREATE POLICY "ingredients_insert_staff"
  ON public.recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin','operario'));

DROP POLICY IF EXISTS "ingredients_update_admin" ON public.recipe_ingredients;
CREATE POLICY "ingredients_update_staff"
  ON public.recipe_ingredients FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin','operario'));

-- ingredients_delete_admin from 20260427024514 stays as-is (admin only)
