-- Replace auto_confirm_email with a no-op.
-- Cannot DROP the trigger (it lives on auth.users which Insforge protects).
-- Replacing the function body is enough — the trigger fires but does nothing.
-- Previously it set NEW.email_confirmed_at which does not exist in Insforge,
-- causing "record new has no field email_confirmed_at" on every signUp.

CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
