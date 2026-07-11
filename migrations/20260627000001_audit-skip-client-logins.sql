-- ============================================================
-- PAuleam ERP — Auditoría: skip login events for client role
-- Suprime LOGIN / LOGOUT / LOGIN_FAILED para cuentas con role='cliente'.
-- Los demás audit triggers (products, production_orders,
-- packaging_orders, profiles) no son alcanzables por clientes
-- porque RLS bloquea UPDATE/INSERT en esas tablas para 'cliente'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id     UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID  DEFAULT NULL,
  p_old_values  JSONB DEFAULT NULL,
  p_new_values  JSONB DEFAULT NULL,
  p_details     TEXT  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Login events for client accounts are not audited.
  -- LOGIN_FAILED with a null p_user_id is preserved (unauthenticated attempt).
  IF p_action IN ('LOGIN', 'LOGOUT', 'LOGIN_FAILED')
     AND p_user_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = p_user_id AND role = 'cliente'
     )
  THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id,
    old_values, new_values, details
  ) VALUES (
    p_user_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_details
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- GRANT EXECUTE ya cubre la firma (anon + authenticated); CREATE OR REPLACE
-- preserva los permisos existentes.
