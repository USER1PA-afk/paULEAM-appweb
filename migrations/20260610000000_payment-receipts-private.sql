-- Migration: Secure payment-receipts storage bucket (private + RLS)
--
-- IMPORTANT: Also run via CLI to disable public URL access at the storage layer:
--   insforge storage update-bucket payment-receipts --private
--
-- This migration adds RLS policies so that even with direct bucket access attempts,
-- only the file owner and staff (admin/operario) can read receipts.

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive open policies for this bucket
DROP POLICY IF EXISTS "payment-receipts public read"   ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts public insert" ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts owner insert"  ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts read"          ON storage.objects;
DROP POLICY IF EXISTS "payment-receipts staff delete"  ON storage.objects;

-- Owners can upload their own receipts (path must start with their user id)
CREATE POLICY "payment-receipts owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can read their own receipts; admin/operario can read all
CREATE POLICY "payment-receipts read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
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
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operario')
    )
  );
