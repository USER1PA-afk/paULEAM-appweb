-- ============================================================
-- PAuleam ERP — Módulo de Auditoría
-- Tabla: audit_log (append-only, sin UPDATE ni DELETE)
-- Vista:  audit_log_view (join a profiles para user_name)
-- RPC:    log_audit_event (SECURITY DEFINER)
-- Triggers: products, production_orders, packaging_orders, profiles
-- ============================================================

-- ============================
-- 1. TABLA audit_log
-- ============================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  -- LOGIN | LOGOUT | LOGIN_FAILED | INSERT | UPDATE | DELETE
  -- STATUS_CHANGE | ROLE_CHANGE | ACTIVATION_CHANGE
  entity_type   TEXT        NOT NULL,
  -- auth_session | products | production_orders | packaging_orders
  -- orders | profiles | recipes
  entity_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  details       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id     ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id   ON public.audit_log(entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================
-- 2. RLS — solo admin SELECT
--    No hay política INSERT para usuarios; solo la RPC SECURITY DEFINER escribe.
-- ============================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- 3. RPC log_audit_event — único camino de escritura
--    Usado por triggers Y por el frontend para eventos de sesión.
-- ============================
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

-- ============================
-- 4. VISTA audit_log_view
-- ============================
CREATE OR REPLACE VIEW public.audit_log_view AS
  SELECT
    al.id,
    al.user_id,
    COALESCE(p.full_name, 'Sistema') AS user_name,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.details,
    al.created_at
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.user_id;

-- La vista hereda RLS de audit_log automáticamente (security invoker por defecto).

-- ============================
-- 5. TRIGGER: products (UPDATE)
--    Audita cambios en name, price, type, cost_per_unit
-- ============================
CREATE OR REPLACE FUNCTION public.audit_products_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (OLD.name          IS DISTINCT FROM NEW.name)
  OR (OLD.price         IS DISTINCT FROM NEW.price)
  OR (OLD.type          IS DISTINCT FROM NEW.type)
  OR (OLD.cost_per_unit IS DISTINCT FROM NEW.cost_per_unit)
  THEN
    PERFORM public.log_audit_event(
      auth.uid(),
      'UPDATE',
      'products',
      NEW.id,
      jsonb_build_object(
        'name',          OLD.name,
        'price',         OLD.price,
        'type',          OLD.type,
        'cost_per_unit', OLD.cost_per_unit
      ),
      jsonb_build_object(
        'name',          NEW.name,
        'price',         NEW.price,
        'type',          NEW.type,
        'cost_per_unit', NEW.cost_per_unit
      ),
      FORMAT('Producto "%s" actualizado', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_products_update ON public.products;
CREATE TRIGGER trg_audit_products_update
  AFTER UPDATE OF name, price, type, cost_per_unit ON public.products
  FOR EACH ROW
  WHEN (
    OLD.name          IS DISTINCT FROM NEW.name OR
    OLD.price         IS DISTINCT FROM NEW.price OR
    OLD.type          IS DISTINCT FROM NEW.type OR
    OLD.cost_per_unit IS DISTINCT FROM NEW.cost_per_unit
  )
  EXECUTE FUNCTION public.audit_products_update();

-- ============================
-- 6. TRIGGER: production_orders (UPDATE de status)
-- ============================
CREATE OR REPLACE FUNCTION public.audit_production_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_audit_event(
      auth.uid(),
      'STATUS_CHANGE',
      'production_orders',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      FORMAT('Orden de producción %s: %s → %s',
        LEFT(NEW.id::TEXT, 8), OLD.status, NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_production_orders ON public.production_orders;
CREATE TRIGGER trg_audit_production_orders
  AFTER UPDATE OF status ON public.production_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_production_orders_update();

-- ============================
-- 7. TRIGGER: packaging_orders (UPDATE de status)
-- ============================
CREATE OR REPLACE FUNCTION public.audit_packaging_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_audit_event(
      auth.uid(),
      'STATUS_CHANGE',
      'packaging_orders',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      FORMAT('Orden de empaque %s: %s → %s',
        LEFT(NEW.id::TEXT, 8), OLD.status, NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_packaging_orders ON public.packaging_orders;
CREATE TRIGGER trg_audit_packaging_orders
  AFTER UPDATE OF status ON public.packaging_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_packaging_orders_update();

-- ============================
-- 8. TRIGGER: profiles (UPDATE de role o is_active)
-- ============================
CREATE OR REPLACE FUNCTION public.audit_profiles_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.log_audit_event(
      auth.uid(),
      'ROLE_CHANGE',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      FORMAT('Rol de usuario %s: %s → %s', NEW.id, OLD.role, NEW.role)
    );
  END IF;

  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    PERFORM public.log_audit_event(
      auth.uid(),
      'ACTIVATION_CHANGE',
      'profiles',
      NEW.id,
      jsonb_build_object('is_active', OLD.is_active),
      jsonb_build_object('is_active', NEW.is_active),
      FORMAT('Cuenta %s: %s', NEW.id,
        CASE WHEN NEW.is_active THEN 'activada' ELSE 'desactivada' END)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE OF role, is_active ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.role      IS DISTINCT FROM NEW.role OR
    OLD.is_active IS DISTINCT FROM NEW.is_active
  )
  EXECUTE FUNCTION public.audit_profiles_update();

-- ============================
-- 9. PERMISOS
-- ============================
-- anon necesita ejecutar log_audit_event para registrar LOGIN_FAILED (usuario no autenticado)
GRANT EXECUTE ON FUNCTION public.log_audit_event(UUID, TEXT, TEXT, UUID, JSONB, JSONB, TEXT)
  TO authenticated, anon;

GRANT SELECT ON public.audit_log_view TO authenticated;
