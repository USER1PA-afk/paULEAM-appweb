-- Migration: Secure payment-receipts storage bucket (private + RLS)
--
-- IMPORTANT: Also run via CLI to disable public URL access at the storage layer:
--   insforge storage create-bucket payment-receipts --private
--   (was originally created public; later flipped private in 20260610000000)
--
-- Storage schema note: storage.objects columns are (bucket, key, uploaded_by, ...).
-- The path of an object is `key`. We split it on '/' to extract the user folder.

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive open policies for this bucket
DROP POLICY IF EXISTS "payment-receipts public read"   ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts public insert" ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts owner insert"  ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts read"          ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts staff delete"  ON storage.objects;

-- Owners can upload their own receipts (key must start with their user id)
CREATE POLICY "payment-receipts owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket = 'payment-receipts'
    AND (split_part(key, '/', 1)) = auth.uid()::text
  );

-- Owners can read their own receipts; admin/operario can read all
CREATE POLICY "payment-receipts read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket = 'payment-receipts'
    AND (
      (split_part(key, '/', 1)) = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'operario')
      )
    )
  );

-- Only staff can delete receipts
CREATE POLICY "payment-receipts staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket = 'payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operario')
    )
  );
