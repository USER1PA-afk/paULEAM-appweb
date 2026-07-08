-- ============================================================
-- PAuleam ERP — Módulo de Promociones (solo tienda online)
-- ============================================================
-- Tablas:  promotions, promotion_products
-- Órdenes: orders.discount_total, orders.applied_promotions (snapshot JSONB),
--          order_items.discount_amount (informativo por línea)
-- RPC:     get_active_promotions() — promos activas/en ventana + sus productos
--
-- Semántica de persistencia:
--   * order_items.unit_price y subtotal quedan BRUTOS (precio original).
--   * orders.total pasa a ser NETO (bruto − discount_total).
--   Así fn_finalize_online_order, el egreso de stock y las estadísticas
--   de ventas no cambian — las promociones afectan PRECIO, nunca cantidad.
--
-- El POS (/pos, process_kiosk_sale) NO lee promociones.
-- ============================================================

-- ============================
-- 1. Tabla promotions
-- ============================
CREATE TABLE IF NOT EXISTS public.promotions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT,
  type               TEXT NOT NULL CHECK (type IN ('DESCUENTO_SIMPLE', 'POR_CANTIDAD', 'NXM', 'COMBO')),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  start_date         TIMESTAMPTZ,   -- NULL = sin límite inferior
  end_date           TIMESTAMPTZ,   -- NULL = sin límite superior

  -- DESCUENTO_SIMPLE: exactamente uno de discount_percent | discount_amount
  -- POR_CANTIDAD:     min_quantity + exactamente uno de discount_percent | special_unit_price
  discount_percent   NUMERIC(5,2)  CHECK (discount_percent > 0 AND discount_percent <= 100),
  discount_amount    NUMERIC(12,2) CHECK (discount_amount > 0),        -- $ de descuento por unidad
  special_unit_price NUMERIC(12,2) CHECK (special_unit_price >= 0),    -- precio especial por unidad
  min_quantity       INTEGER       CHECK (min_quantity >= 2),

  -- NXM: lleva nxm_take, paga nxm_pay
  nxm_take           INTEGER       CHECK (nxm_take > 1),
  nxm_pay            INTEGER       CHECK (nxm_pay >= 1),

  -- COMBO: precio del paquete completo
  bundle_price       NUMERIC(12,2) CHECK (bundle_price > 0),

  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT promotions_dates_chk CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date > start_date
  ),

  -- Config válida y excluyente por tipo
  CONSTRAINT promotions_type_config_chk CHECK (
    (type = 'DESCUENTO_SIMPLE'
       AND (discount_percent IS NOT NULL) <> (discount_amount IS NOT NULL)
       AND special_unit_price IS NULL AND min_quantity IS NULL
       AND nxm_take IS NULL AND nxm_pay IS NULL AND bundle_price IS NULL)
    OR
    (type = 'POR_CANTIDAD'
       AND min_quantity IS NOT NULL
       AND (discount_percent IS NOT NULL) <> (special_unit_price IS NOT NULL)
       AND discount_amount IS NULL
       AND nxm_take IS NULL AND nxm_pay IS NULL AND bundle_price IS NULL)
    OR
    (type = 'NXM'
       AND nxm_take IS NOT NULL AND nxm_pay IS NOT NULL AND nxm_pay < nxm_take
       AND discount_percent IS NULL AND discount_amount IS NULL
       AND special_unit_price IS NULL AND min_quantity IS NULL AND bundle_price IS NULL)
    OR
    (type = 'COMBO'
       AND bundle_price IS NOT NULL
       AND discount_percent IS NULL AND discount_amount IS NULL
       AND special_unit_price IS NULL AND min_quantity IS NULL
       AND nxm_take IS NULL AND nxm_pay IS NULL)
  )
);

-- ============================
-- 2. Tabla promotion_products
-- ============================
-- COMBO: varias filas (producto + cantidad requerida).
-- Otros tipos: una sola fila con quantity = 1.
CREATE TABLE IF NOT EXISTS public.promotion_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id),
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  UNIQUE (promotion_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON public.promotions (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_promotion_products_promo
  ON public.promotion_products (promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product
  ON public.promotion_products (product_id);

-- ============================
-- 3. RLS
-- ============================
ALTER TABLE public.promotions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

-- Público (anon + authenticated) ve promos activas y en ventana; staff ve todas.
DROP POLICY IF EXISTS "promotions_select" ON public.promotions;
CREATE POLICY "promotions_select"
  ON public.promotions FOR SELECT
  TO anon, authenticated
  USING (
    (is_active
      AND (start_date IS NULL OR start_date <= now())
      AND (end_date IS NULL OR end_date >= now()))
    OR public.get_user_role() IN ('admin', 'operario')
  );

DROP POLICY IF EXISTS "promotions_insert_admin" ON public.promotions;
CREATE POLICY "promotions_insert_admin"
  ON public.promotions FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "promotions_update_admin" ON public.promotions;
CREATE POLICY "promotions_update_admin"
  ON public.promotions FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "promotions_delete_admin" ON public.promotions;
CREATE POLICY "promotions_delete_admin"
  ON public.promotions FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Las filas hijas solo exponen (producto, cantidad) — lectura pública simple.
DROP POLICY IF EXISTS "promotion_products_select" ON public.promotion_products;
CREATE POLICY "promotion_products_select"
  ON public.promotion_products FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "promotion_products_insert_admin" ON public.promotion_products;
CREATE POLICY "promotion_products_insert_admin"
  ON public.promotion_products FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "promotion_products_update_admin" ON public.promotion_products;
CREATE POLICY "promotion_products_update_admin"
  ON public.promotion_products FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "promotion_products_delete_admin" ON public.promotion_products;
CREATE POLICY "promotion_products_delete_admin"
  ON public.promotion_products FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- 4. Persistencia de descuentos en órdenes
-- ============================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  ADD COLUMN IF NOT EXISTS applied_promotions JSONB;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

-- ============================
-- 5. RPC get_active_promotions()
-- ============================
-- Un solo round-trip: promos activas/en ventana con sus líneas de producto.
-- SECURITY DEFINER evita depender de la RLS, pero el WHERE repite el mismo
-- filtro — anon nunca ve promos inactivas por ninguna vía.
CREATE OR REPLACE FUNCTION public.get_active_promotions()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                 p.id,
      'name',               p.name,
      'description',        p.description,
      'type',               p.type,
      'discount_percent',   p.discount_percent,
      'discount_amount',    p.discount_amount,
      'special_unit_price', p.special_unit_price,
      'min_quantity',       p.min_quantity,
      'nxm_take',           p.nxm_take,
      'nxm_pay',            p.nxm_pay,
      'bundle_price',       p.bundle_price,
      'start_date',         p.start_date,
      'end_date',           p.end_date,
      'products', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'product_id', pp.product_id,
          'quantity',   pp.quantity
        )), '[]'::jsonb)
        FROM public.promotion_products pp
        WHERE pp.promotion_id = p.id
      )
    ) ORDER BY p.created_at
  ), '[]'::jsonb)
  FROM public.promotions p
  WHERE p.is_active
    AND (p.start_date IS NULL OR p.start_date <= now())
    AND (p.end_date IS NULL OR p.end_date >= now());
$$;

GRANT EXECUTE ON FUNCTION public.get_active_promotions() TO anon, authenticated;
