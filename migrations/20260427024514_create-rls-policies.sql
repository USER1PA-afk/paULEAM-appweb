-- ============================================================
-- PAuleam ERP — Migración 002: Row Level Security (RLS)
-- ============================================================
-- Roles: cliente, operario, admin
-- El JWT de Insforge Auth contiene auth.uid() y el role está en profiles.
-- ============================================================

-- Helper: obtener el rol del usuario actual desde profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================
-- PROFILES
-- ============================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver perfiles
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Usuarios solo pueden editar su propio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin puede editar cualquier perfil
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- CATEGORIES
-- ============================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para el e-commerce)
CREATE POLICY "categories_select_all"
  ON public.categories FOR SELECT
  USING (TRUE);

-- Solo admin puede crear/editar/eliminar categorías
CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- PRODUCTS
-- ============================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lectura pública (catálogo e-commerce)
CREATE POLICY "products_select_all"
  ON public.products FOR SELECT
  USING (TRUE);

-- Solo admin y operario pueden crear/editar productos
CREATE POLICY "products_insert_staff"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "products_update_staff"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- LOTS
-- ============================
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lots_select_staff"
  ON public.lots FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "lots_insert_staff"
  ON public.lots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "lots_update_staff"
  ON public.lots FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- ============================
-- INVENTORY LEDGER
-- ============================
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

-- Staff puede ver todo el ledger
CREATE POLICY "ledger_select_staff"
  ON public.inventory_ledger FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- Solo staff puede insertar movimientos
CREATE POLICY "ledger_insert_staff"
  ON public.inventory_ledger FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

-- NUNCA permitir UPDATE ni DELETE (inmutable)
-- No se crean policies para UPDATE/DELETE, RLS las bloquea por defecto.

-- ============================
-- RECIPES
-- ============================
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select_staff"
  ON public.recipes FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "recipes_insert_admin"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "recipes_update_admin"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- RECIPE INGREDIENTS
-- ============================
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredients_select_staff"
  ON public.recipe_ingredients FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "ingredients_insert_admin"
  ON public.recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "ingredients_update_admin"
  ON public.recipe_ingredients FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "ingredients_delete_admin"
  ON public.recipe_ingredients FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================
-- PRODUCTION ORDERS
-- ============================
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_select_staff"
  ON public.production_orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "production_insert_staff"
  ON public.production_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operario'));

CREATE POLICY "production_update_staff"
  ON public.production_orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- ============================
-- ORDERS (E-Commerce)
-- ============================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Clientes ven solo sus órdenes, staff ve todas
CREATE POLICY "orders_select_own"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'operario')
  );

-- Clientes pueden crear órdenes
CREATE POLICY "orders_insert_client"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Clientes pueden actualizar sus órdenes PENDIENTES (subir comprobante)
-- Admin puede actualizar cualquier orden
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'PENDIENTE')
    OR public.get_user_role() = 'admin'
  );

-- ============================
-- ORDER ITEMS
-- ============================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.user_id = auth.uid() OR public.get_user_role() IN ('admin', 'operario'))
    )
  );

CREATE POLICY "order_items_insert_client"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- ============================
-- STOCK RESERVATIONS
-- ============================
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias reservas
CREATE POLICY "reservations_select_own"
  ON public.stock_reservations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.get_user_role() = 'admin');

-- Usuarios pueden crear sus propias reservas
CREATE POLICY "reservations_insert_own"
  ON public.stock_reservations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuarios pueden cancelar sus propias reservas, admin puede todas
CREATE POLICY "reservations_delete"
  ON public.stock_reservations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.get_user_role() = 'admin');
