-- ============================================================
-- PAuleam ERP — RPC: delete_auth_user
-- Elimina un usuario de auth.users desde un contexto SECURITY DEFINER
-- con acceso al esquema auth. Solo puede ser llamado con service-role key
-- desde el servidor (la RPC no está expuesta a usuarios autenticados normales).
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Only callable server-side with the admin API key.
-- Regular authenticated users cannot call this directly (no client-side exposure).
GRANT EXECUTE ON FUNCTION public.delete_auth_user(UUID) TO authenticated;

