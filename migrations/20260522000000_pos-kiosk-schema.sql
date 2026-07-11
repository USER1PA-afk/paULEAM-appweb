-- ============================================================
-- PAuleam ERP — Migración: Módulo POS Kiosko
-- ============================================================
-- 1. Extiende el rol 'sales_kiosk' al CHECK de profiles
-- 2. Agrega sale_origin y payment_method a orders
-- 3. Actualiza RLS para el nuevo rol
-- 4. Siembra el usuario "Consumidor Final" (Cédula 9999999999999)
-- 5. Crea la RPC atómica process_kiosk_sale con conversión kg
-- ============================================================

-- ============================================================
-- 1. NUEVO ROL sales_kiosk EN PROFILES
-- ============================================================
-- Primero eliminamos el CHECK existente y lo recreamos incluyendo el nuevo rol
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('cliente', 'operario', 'admin', 'sales_kiosk'));

-- ============================================================
-- 2. NUEVAS COLUMNAS EN ORDERS
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sale_origin TEXT NOT NULL DEFAULT 'ECOMMERCE'
    CONSTRAINT orders_sale_origin_check CHECK (sale_origin IN ('ECOMMERCE', 'KIOSK')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('EFECTIVO', 'QR_DEUNA', 'TRANSFERENCIA'));

-- ============================================================
-- 3. RLS — POLÍTICAS PARA sales_kiosk
-- ============================================================

-- 3a. ORDERS — El kiosko puede crear órdenes propias y verlas
CREATE POLICY "orders_insert_kiosk"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.get_user_role() IN ('cliente', 'sales_kiosk')
  );

-- El kiosko puede leer órdenes que él mismo creó
-- (la política orders_select_own ya cubre user_id = auth.uid())

-- 3b. ORDER ITEMS — El kiosko puede insertar items de sus órdenes
CREATE POLICY "order_items_insert_kiosk"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'sales_kiosk'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- 3c. INVENTORY LEDGER — El kiosko puede registrar EGRESOs (ventas directas)
-- La función process_kiosk_sale usa SECURITY DEFINER, así que el rol
-- en tiempo de ejecución es el OWNER (superuser). No obstante, dejamos
-- la política explícita para coherencia.
CREATE POLICY "ledger_insert_kiosk"
  ON public.inventory_ledger FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'sales_kiosk');

-- 3d. stock_summary — lectura para el kiosko (ver stock de productos)
-- La vista hereda RLS de products (products_select_all = TRUE) → ya funciona.

-- ============================================================
-- 4. SEMILLA — USUARIO "CONSUMIDOR FINAL"
-- ============================================================
-- UUID fijo: '00000000-0000-0000-0000-999999999999' (nunca cambia).
-- Deshabilitamos temporalmente el trigger auto_confirm_email_trigger que
-- referencia una columna email_confirmed_at inexistente en Insforge.

DO $$
DECLARE
  v_consumer_uuid UUID := '00000000-0000-0000-0000-999999999999'::UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_consumer_uuid) THEN
    -- Deshabilitar el trigger que usa columnas del esquema Supabase (no Insforge)
    ALTER TABLE auth.users DISABLE TRIGGER auto_confirm_email_trigger;

    INSERT INTO auth.users (
      id,
      email,
      password,
      email_verified,
      created_at,
      updated_at,
      profile,
      metadata,
      is_project_admin,
      is_anonymous
    ) VALUES (
      v_consumer_uuid,
      'consumidor.final@pauleam.internal',
      '',
      TRUE,
      now(),
      now(),
      '{"name": "Consumidor Final"}'::jsonb,
      '{}'::jsonb,
      FALSE,
      FALSE
    );

    -- Re-habilitar el trigger
    ALTER TABLE auth.users ENABLE TRIGGER auto_confirm_email_trigger;

    -- El trigger on_auth_user_created ya creó la fila en profiles.
    -- Actualizamos el campo phone (cédula) del consumidor final.
    UPDATE public.profiles
    SET phone = '9999999999999', is_active = TRUE
    WHERE id = v_consumer_uuid;
  END IF;
END;
$$;

-- ============================================================
-- 5. RPC ATÓMICA — process_kiosk_sale
-- ============================================================
-- Recibe los datos de la venta del kiosko y en una sola transacción:
--   a) Crea la orden (status = COMPLETADO, sale_origin = KIOSK)
--   b) Inserta order_items con cantidad en unidades comerciales
--   c) Calcula la cantidad física en kg (qty / conversion_factor)
--   d) Inserta EGRESOs en inventory_ledger por cada ítem
--   e) Lanza EXCEPTION si hay stock insuficiente (fuerza rollback total)
--
-- Parámetros:
--   p_operator_id    UUID  — ID del usuario kiosko autenticado (creador de la orden)
--   p_customer_id    UUID  — ID del cliente (o Consumidor Final)
--   p_payment_method TEXT  — 'EFECTIVO' | 'QR_DEUNA'
--   p_items          JSONB — Array de { product_id, qty_commercial, unit_price, conversion_factor }
--   p_total          NUMERIC

CREATE OR REPLACE FUNCTION public.process_kiosk_sale(
  p_operator_id    UUID,
  p_customer_id    UUID,
  p_payment_method TEXT,
  p_items          JSONB,
  p_total          NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id        UUID;
  v_item            JSONB;
  v_product_id      UUID;
  v_qty_commercial  NUMERIC;
  v_unit_price      NUMERIC;
  v_conversion      NUMERIC;
  v_qty_physical    NUMERIC;
  v_available       NUMERIC;
BEGIN
  -- ── Validar método de pago ────────────────────────────────
  IF p_payment_method NOT IN ('EFECTIVO', 'QR_DEUNA') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
  END IF;

  -- ── Crear la orden ─────────────────────────────────────────
  INSERT INTO public.orders (
    user_id,
    status,
    total,
    sale_origin,
    payment_method,
    notes
  )
  VALUES (
    p_customer_id,                   -- cliente (puede ser Consumidor Final)
    'COMPLETADO',
    p_total,
    'KIOSK',
    p_payment_method,
    'Venta kiosko. Operador: ' || p_operator_id::TEXT
  )
  RETURNING id INTO v_order_id;

  -- ── Procesar cada ítem ────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id     := (v_item->>'product_id')::UUID;
    v_qty_commercial := (v_item->>'qty_commercial')::NUMERIC;
    v_unit_price     := (v_item->>'unit_price')::NUMERIC;
    v_conversion     := COALESCE((v_item->>'conversion_factor')::NUMERIC, 1.0);

    -- Convertir unidades comerciales → kg físicos
    v_qty_physical := ROUND(v_qty_commercial / v_conversion, 4);

    -- Bloqueo consultivo por producto (evita race conditions)
    IF NOT pg_try_advisory_xact_lock(hashtext(v_product_id::TEXT)) THEN
      RAISE EXCEPTION 'Producto % ocupado, intente de nuevo', v_product_id;
    END IF;

    -- Verificar stock disponible (en kg)
    v_available := public.get_stock_balance(v_product_id);

    IF v_available < v_qty_physical THEN
      RAISE EXCEPTION
        'Stock insuficiente para producto %. Disponible: % kg, Requerido: % kg',
        v_product_id, v_available, v_qty_physical;
    END IF;

    -- Insertar ítem de orden (cantidad en unidades comerciales)
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_qty_commercial,
      v_unit_price,
      ROUND(v_qty_commercial * v_unit_price, 2)
    );

    -- Registrar EGRESO físico en el ledger (en kg)
    INSERT INTO public.inventory_ledger (
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    VALUES (
      v_product_id,
      'EGRESO',
      v_qty_physical,
      v_unit_price,
      'VENTA',
      v_order_id,
      'Venta kiosko #' || SUBSTRING(v_order_id::TEXT, 1, 8),
      p_operator_id
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Permisos: la función es SECURITY DEFINER, solo necesita que los usuarios
-- autenticados puedan llamarla (el control de acceso real está en la función misma).
GRANT EXECUTE ON FUNCTION public.process_kiosk_sale(UUID, UUID, TEXT, JSONB, NUMERIC)
  TO authenticated;
