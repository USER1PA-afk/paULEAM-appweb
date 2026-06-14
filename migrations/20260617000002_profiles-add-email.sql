-- Add email column to profiles for server-side email-existence checks.
-- Needed by /api/auth/send-reset-code to gate OTP sends without
-- exposing registration status to the client.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill existing rows from auth.users.
-- Must run as SECURITY DEFINER to cross the public→auth schema boundary.
CREATE OR REPLACE FUNCTION public._backfill_profiles_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles p
  SET    email = u.email
  FROM   auth.users u
  WHERE  p.id = u.id
    AND  p.email IS NULL;
END;
$$;

SELECT public._backfill_profiles_email();
DROP FUNCTION public._backfill_profiles_email();

-- Keep email in sync for all future registrations.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
