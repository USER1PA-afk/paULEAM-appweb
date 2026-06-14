-- Remove raw_user_meta_data references — that column is Supabase-specific
-- and does not exist in Insforge's auth.users schema.
-- full_name is set to NEW.email temporarily; the complete-register API route
-- overwrites it with the actual name immediately after signUp succeeds.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    NEW.email,
    'cliente',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
