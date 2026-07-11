-- ============================================================
-- PAuleam ERP — Fix: next_batch_number(unknown) does not exist
-- ============================================================
-- LANGUAGE SQL no resuelve el tipo 'unknown' de literales de cadena
-- cuando la función es llamada desde contextos PL/pgSQL en algunas
-- versiones de PostgreSQL. Redefinir como plpgsql elimina el problema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_batch_number(prefix TEXT DEFAULT 'PROD')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN prefix || '-' || TO_CHAR(now(), 'YYYY') || '-' ||
         LPAD(nextval('public.production_batch_seq')::TEXT, 4, '0');
END;
$$;
