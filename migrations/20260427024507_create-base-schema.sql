-- ============================================================
-- PAuleam ERP — Migración 001: Esquema Base
-- ============================================================
-- Tablas: profiles, categories, products, lots, inventory_ledger,
--         recipes, recipe_ingredients, production_orders,
--         orders, order_items, stock_reservations
-- ============================================================

-- ============================
-- 1. PROFILES (extiende auth.users)
-- ============================
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'cliente'
             CHECK (role IN ('cliente', 'operario', 'admin')),
  phone      TEXT,
  address    TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para crear perfil automáticamente al signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================
-- 2. CATEGORÍAS DE PRODUCTOS
-- ============================
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================
-- 3. PRODUCTOS
-- ============================
CREATE TYPE public.product_type AS ENUM ('MATERIA_PRIMA', 'PRODUCTO_TERMINADO');

CREATE TABLE public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  sku         TEXT NOT NULL UNIQUE,
  type        public.product_type NOT NULL,
  unit        TEXT NOT NULL,               -- kg, lt, unidades, etc.
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  price       NUMERIC(12,2) DEFAULT 0,     -- Solo relevante para PRODUCTO_TERMINADO
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_type ON public.products(type);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category_id);

-- ============================
-- 4. LOTES
-- ============================
CREATE TABLE public.lots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number    TEXT NOT NULL,
  expiry_date   DATE,
  supplier      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_lots_product_number ON public.lots(product_id, lot_number);

-- ============================
-- 5. INVENTORY LEDGER (Doble Entrada — Inmutable)
-- ============================
-- REGLA: NUNCA usar UPDATE ni DELETE sobre esta tabla.
-- Todo movimiento de stock es un INSERT con tipo INGRESO o EGRESO.
-- El stock actual se calcula con SUM(CASE ...) sobre esta tabla.
CREATE TYPE public.movement_type AS ENUM ('INGRESO', 'EGRESO');

CREATE TABLE public.inventory_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  lot_id            UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  movement_type     public.movement_type NOT NULL,
  quantity          NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_cost         NUMERIC(12,2) DEFAULT 0,
  reference_type    TEXT,         -- 'COMPRA', 'PRODUCCION', 'VENTA', 'AJUSTE', 'RESERVA'
  reference_id      UUID,         -- ID de la orden de producción, venta, etc.
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_product ON public.inventory_ledger(product_id);
CREATE INDEX idx_ledger_lot ON public.inventory_ledger(lot_id);
CREATE INDEX idx_ledger_reference ON public.inventory_ledger(reference_type, reference_id);
CREATE INDEX idx_ledger_created_at ON public.inventory_ledger(created_at DESC);

-- Vista materializada para consulta rápida de stock
CREATE OR REPLACE FUNCTION public.get_stock_balance(p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN movement_type = 'INGRESO' THEN quantity
        WHEN movement_type = 'EGRESO' THEN -quantity
      END
    ), 0
  )
  FROM public.inventory_ledger
  WHERE product_id = p_product_id;
$$ LANGUAGE SQL STABLE;

-- Vista de stock por producto
CREATE OR REPLACE VIEW public.stock_summary AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.type,
  p.unit,
  public.get_stock_balance(p.id) AS stock_actual
FROM public.products p
WHERE p.is_active = TRUE;

-- ============================
-- 6. RECETAS
-- ============================
CREATE TABLE public.recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  output_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  yield_base        NUMERIC(14,4) NOT NULL CHECK (yield_base > 0),
  yield_unit        TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_output ON public.recipes(output_product_id);

-- ============================
-- 7. INGREDIENTES DE RECETA
-- ============================
CREATE TABLE public.recipe_ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredients_recipe ON public.recipe_ingredients(recipe_id);

-- ============================
-- 8. ÓRDENES DE PRODUCCIÓN
-- ============================
CREATE TYPE public.production_status AS ENUM (
  'BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'
);

CREATE TABLE public.production_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         UUID NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  target_yield      NUMERIC(14,4) NOT NULL CHECK (target_yield > 0),
  status            public.production_status NOT NULL DEFAULT 'BORRADOR',
  notes             TEXT,
  completed_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_status ON public.production_orders(status);
CREATE INDEX idx_production_recipe ON public.production_orders(recipe_id);

-- ============================
-- 9. ÓRDENES DE VENTA (E-Commerce)
-- ============================
CREATE TYPE public.order_status AS ENUM (
  'PENDIENTE', 'PAGADO', 'APROBADO', 'ENVIADO', 'COMPLETADO', 'CANCELADO'
);

CREATE TABLE public.orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id),
  status               public.order_status NOT NULL DEFAULT 'PENDIENTE',
  total                NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_receipt_url  TEXT,       -- URL del comprobante en Insforge Storage
  shipping_address     TEXT,
  notes                TEXT,
  approved_by          UUID REFERENCES auth.users(id),
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- ============================
-- 10. ITEMS DE ORDEN
-- ============================
CREATE TABLE public.order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL,
  subtotal    NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ============================
-- 11. RESERVAS DE STOCK (Carrito)
-- ============================
-- Reservas temporales para evitar sobreventa.
-- Se limpian con un cron job cada minuto.
CREATE TABLE public.stock_reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity    NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_user ON public.stock_reservations(user_id);
CREATE INDEX idx_reservations_product ON public.stock_reservations(product_id);
CREATE INDEX idx_reservations_expires ON public.stock_reservations(expires_at);

-- Función para obtener stock disponible (stock real - reservas activas)
CREATE OR REPLACE FUNCTION public.get_available_stock(p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT public.get_stock_balance(p_product_id)
    - COALESCE(
        (SELECT SUM(quantity)
         FROM public.stock_reservations
         WHERE product_id = p_product_id
           AND expires_at > now()),
        0
      );
$$ LANGUAGE SQL STABLE;

-- Función para reservar stock con bloqueo consultivo
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_user_id    UUID,
  p_product_id UUID,
  p_quantity   NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_available  NUMERIC;
  v_reservation_id UUID;
BEGIN
  -- Bloqueo consultivo por producto para evitar race conditions
  IF NOT pg_try_advisory_xact_lock(hashtext(p_product_id::TEXT)) THEN
    RAISE EXCEPTION 'Producto ocupado, intente de nuevo';
  END IF;

  -- Verificar stock disponible
  v_available := public.get_available_stock(p_product_id);

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_available, p_quantity;
  END IF;

  -- Crear reserva (expira en 15 minutos)
  INSERT INTO public.stock_reservations (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, p_quantity)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar reservas expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.stock_reservations
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================
-- 12. BUCKET DE STORAGE
-- ============================
-- El bucket 'payment-receipts' se crea vía CLI:
-- npx @insforge/cli storage create-bucket payment-receipts --public
-- El bucket 'product-images' se crea vía CLI:
-- npx @insforge/cli storage create-bucket product-images --public

-- ============================
-- 13. HELPER: Updated_at trigger
-- ============================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger updated_at a todas las tablas con ese campo
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_production_orders_updated_at
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
