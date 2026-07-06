-- ============================================================
-- PAuleam ERP — RPC: delete_staff_user
-- Solo los administradores pueden eliminar personal del sistema
-- (usuarios con rol distinto a 'cliente').
-- Doble barrera:
--   1. SECURITY DEFINER verifica auth.uid() contra profiles.role
--   2. Bloquea la eliminación del propio admin que ejecuta la acción
--   3. Solo afecta roles de personal (admin, operario, sales_kiosk)
-- Escribe en audit_log antes de eliminar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_staff_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_target_role  TEXT;
  v_target_name  TEXT;
BEGIN
  -- 1. Verificar que el llamador es admin
  SELECT role INTO v_caller_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: solo el administrador puede eliminar personal del sistema';
  END IF;

  -- 2. Obtener rol y nombre del usuario a eliminar
  SELECT role, full_name INTO v_target_role, v_target_name
    FROM public.profiles
   WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: usuario % no encontrado', p_target_user_id;
  END IF;

  -- 3. Solo permite eliminar roles de personal (no clientes)
  IF v_target_role = 'cliente' THEN
    RAISE EXCEPTION 'INVALID_ROLE: esta función solo elimina personal del sistema (no clientes)';
  END IF;

  -- 4. Impedir que el admin se elimine a sí mismo
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'SELF_DELETE: el administrador no puede eliminarse a sí mismo';
  END IF;

  -- 5. Registrar en audit_log ANTES de eliminar (para tener rastro)
  PERFORM public.log_audit_event(
    auth.uid(),
    'DELETE',
    'profiles',
    p_target_user_id,
    jsonb_build_object('role', v_target_role, 'full_name', v_target_name),
    NULL,
    FORMAT('Eliminación de personal: %s (rol: %s)', v_target_name, v_target_role)
  );

  -- 6. Eliminar perfil de public.profiles
  --    auth.users se limpia vía ON DELETE CASCADE configurado en handle_new_user
  DELETE FROM public.profiles WHERE id = p_target_user_id;

  -- 7. Intentar eliminar de auth.users usando la función admin de Insforge/Supabase
  --    Nota: auth.admin_delete_user solo está disponible en contexto SECURITY DEFINER
  --    con search_path=auth o vía service_role. Aquí eliminamos solo el perfil;
  --    el usuario de auth se maneja desde la API del servidor con service_role.
  --    (Ver /api/admin/delete-staff-user route que combina ambas operaciones.)

END;
$$;

-- Solo los usuarios autenticados pueden llamar esta función,
-- pero internamente verifica que sea admin.
GRANT EXECUTE ON FUNCTION public.delete_staff_user(UUID) TO authenticated;
