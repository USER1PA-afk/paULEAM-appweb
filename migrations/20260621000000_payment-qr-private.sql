-- Migration: payment-qr private bucket + RLS + payment_config.qr_key column
--
-- Single shared QR image (Pichincha / DeUna) used by both the storefront
-- and the POS. Admin-only writes/deletes; any authenticated user can read
-- through the `/api/payment-qr/[...path]` proxy.
--
-- IMPORTANT: the bucket itself was created via CLI:
--   npx @insforge/cli storage create-bucket payment-qr --private
--
-- Storage schema note: storage.objects columns are (bucket, key, uploaded_by, ...)

-- 1. Extend payment_config to track the storage path of the uploaded QR.
ALTER TABLE public.payment_config
  ADD COLUMN IF NOT EXISTS pichincha_qr_key TEXT;

COMMENT ON COLUMN public.payment_config.pichincha_qr_key IS
  'Storage key (bucket-relative path) of the Pichincha/DeUna QR image. NULL = no QR uploaded yet.';

-- 2. RLS for the payment-qr bucket.
--    storage.objects is shared by every bucket; we scope every policy with `bucket = 'payment-qr'`.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment-qr admin insert" ON storage.objects;
DROP POLICY IF EXISTS "payment-qr read"         ON storage.objects;
DROP POLICY IF EXISTS "payment-qr admin update" ON storage.objects;
DROP POLICY IF EXISTS "payment-qr admin delete" ON storage.objects;

-- Any authenticated user can read the QR (storefront, POS, admin preview)
CREATE POLICY "payment-qr read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket = 'payment-qr');

-- Only admins can upload the QR
CREATE POLICY "payment-qr admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket = 'payment-qr'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can replace the file
CREATE POLICY "payment-qr admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket = 'payment-qr'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket = 'payment-qr'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete the file
CREATE POLICY "payment-qr admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket = 'payment-qr'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
