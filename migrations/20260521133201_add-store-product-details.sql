-- Extend products table with e-commerce fields for the store admin module
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description  TEXT,
  ADD COLUMN IF NOT EXISTS long_description   TEXT,
  ADD COLUMN IF NOT EXISTS specifications     JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ingredients        TEXT,
  ADD COLUMN IF NOT EXISTS nutritional_info   JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight             NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS commercial_details TEXT,
  ADD COLUMN IF NOT EXISTS featured           BOOLEAN  NOT NULL DEFAULT FALSE;

-- Multi-image support: each product can have multiple images with ordering
CREATE TABLE IF NOT EXISTS public.product_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  alt_text     TEXT,
  position     INTEGER     NOT NULL DEFAULT 0,
  is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product  ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_position ON public.product_images(product_id, position);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_public_read" ON public.product_images;
CREATE POLICY "product_images_public_read"
  ON public.product_images FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "product_images_staff_all" ON public.product_images;
CREATE POLICY "product_images_staff_all"
  ON public.product_images FOR ALL
  USING  (public.get_user_role() IN ('admin', 'operario'))
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));
