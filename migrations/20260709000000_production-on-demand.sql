-- ============================================================
-- PAuleam ERP — Migración: Producción bajo demanda + Reserva exclusiva
-- ============================================================
-- 1. Columna inventory_ledger.reserved_for_user_id para bloquear stock.
-- 2. Tablas production_requests y notifications.
-- 3. Actualización de vistas/functions para ocultar stock reservado.
-- 4. Triggers de notificación y cierre (INGRESO reservado).
-- 5. RLS para staff y clientes.
-- 6. RPC para liquidar saldo pendiente.
-- ============================================================

-- ============================
-- 1. INVENTORY_LEDGER: stock reservado
-- ============================
ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS reserved_for_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_reserved_user
  ON public.inventory_ledger(reserved_for_user_id)
  WHERE reserved_for_user_id IS NOT NULL;

-- Permitir INGRESO de PRODUCTO_TERMINADO por PRODUCCION_DEMANDA
CREATE OR REPLACE FUNCTION public.enforce_finished_product_ingress()
RETURNS TRIGGER AS $$
DECLARE
  v_type public.product_type;
BEGIN
  IF NEW.movement_type = 'INGRESO' THEN
    SELECT type INTO v_type FROM public.products WHERE id = NEW.product_id;

    IF v_type = 'PRODUCTO_A_GRANEL'
       AND NEW.reference_type NOT IN ('PRODUCCION', 'AJUSTE') THEN
      RAISE EXCEPTION
        'Un PRODUCTO_A_GRANEL solo puede recibir INGRESO por PRODUCCION o AJUSTE. Se recibió: %',
        NEW.reference_type;
    END IF;

    IF v_type = 'PRODUCTO_TERMINADO'
       AND NEW.reference_type NOT IN ('PRODUCCION', 'PRODUCCION_DEMANDA', 'EMPAQUE', 'AJUSTE') THEN
      RAISE EXCEPTION
        'Un PRODUCTO_TERMINADO solo puede recibir INGRESO por PRODUCCION, PRODUCCION_DEMANDA, EMPAQUE o AJUSTE. Se recibió: %',
        NEW.reference_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================
-- 2. Recrear inventory_ledger_view (usa il.*)
-- ============================
DROP VIEW IF EXISTS public.inventory_ledger_view CASCADE;

CREATE VIEW public.inventory_ledger_view AS
SELECT
  il.*,
  p.name       AS product_name,
  p.sku        AS product_sku,
  p.unit       AS product_unit,
  p.type       AS product_type,
  s.company    AS supplier_company,
  s.name       AS supplier_name,
  s.ruc        AS supplier_ruc,
  r.name       AS production_recipe_name,
  po.batch_number AS production_batch_number,
  pt.name      AS packaging_template_name,
  CASE il.reference_type
    WHEN 'COMPRA'              THEN 'Compra / Recepción'
    WHEN 'PRODUCCION'          THEN 'Producción'
    WHEN 'PRODUCCION_DEMANDA'  THEN 'Producción bajo demanda'
    WHEN 'EMPAQUE'             THEN 'Empaque'
    WHEN 'VENTA'               THEN 'Venta'
    WHEN 'VENTA_DEMANDA'       THEN 'Venta bajo demanda'
    WHEN 'AJUSTE'              THEN 'Ajuste'
    WHEN 'MERMA'               THEN 'Merma / Pérdida'
    WHEN 'DEVOLUCION'          THEN 'Devolución'
    ELSE COALESCE(il.reference_type, '—')
  END AS reference_type_label
FROM public.inventory_ledger il
LEFT JOIN public.products p ON p.id = il.product_id
LEFT JOIN public.suppliers s ON s.id = il.supplier_id
LEFT JOIN public.production_orders po
  ON po.id = il.reference_id AND il.reference_type = 'PRODUCCION'
LEFT JOIN public.recipes r ON r.id = po.recipe_id
LEFT JOIN public.packaging_orders pkg_o
  ON pkg_o.id = il.reference_id AND il.reference_type = 'EMPAQUE'
LEFT JOIN public.packaging_templates pt ON pt.id = pkg_o.template_id;

GRANT SELECT ON public.inventory_ledger_view TO authenticated;

-- ============================
-- 3. Tablas production_requests y notifications
-- ============================
CREATE TABLE IF NOT EXISTS public.production_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_requested   NUMERIC(14,4) NOT NULL CHECK (quantity_requested > 0),
  total_amount         NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status               TEXT NOT NULL DEFAULT 'PROPOSAL'
                         CHECK (status IN ('PROPOSAL','PENDING_PRODUCTION','IN_PRODUCTION','COMPLETED','REJECTED')),
  receipt_url          TEXT,
  rejection_reason     TEXT,
  balance_receipt_url  TEXT,
  balance_paid_at      TIMESTAMPTZ,
  fulfillment_type     TEXT NOT NULL DEFAULT 'PICK-UP_IN_PLANT'
                         CHECK (fulfillment_type IN ('PICK-UP_IN_PLANT','SHIPPING')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_requests_customer ON public.production_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_production_requests_product  ON public.production_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_production_requests_status   ON public.production_requests(status);
CREATE INDEX IF NOT EXISTS idx_production_requests_created  ON public.production_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'REQUEST' CHECK (type IN ('REQUEST','ALERT')),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ============================
-- 4. Stock disponible: restar reservas ajenas
-- ============================
CREATE OR REPLACE FUNCTION public.get_reserved_stock_not_owned(p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(quantity), 0)
  FROM public.inventory_ledger
  WHERE product_id = p_product_id
    AND movement_type = 'INGRESO'
    AND reserved_for_user_id IS NOT NULL
    AND (auth.uid() IS NULL OR reserved_for_user_id != auth.uid());
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.get_available_stock(p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT GREATEST(0,
    public.get_stock_balance(p_product_id)
      - public.get_reserved_stock_not_owned(p_product_id)
      - COALESCE(
          (SELECT SUM(quantity)
           FROM public.stock_reservations
           WHERE product_id = p_product_id
             AND expires_at > now()),
          0
        )
  );
$$ LANGUAGE SQL STABLE;

-- ============================
-- 5. Actualizar stock_summary
-- ============================
DROP VIEW IF EXISTS public.stock_summary CASCADE;

CREATE VIEW public.stock_summary AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.type,
  p.unit,
  p.price,
  p.image_url,
  p.featured,
  p.is_active,
  p.description,
  p.short_description,
  p.long_description,
  p.specifications,
  p.ingredients,
  p.nutritional_info,
  p.weight,
  p.commercial_details,
  p.conversion_factor,
  p.sales_unit_name,
  p.min_stock_alert,
  p.show_in_pos,
  public.get_stock_balance(p.id) AS stock_actual,
  public.get_available_stock(p.id) AS stock_available
FROM public.products p
WHERE p.is_active = TRUE;

GRANT SELECT ON public.stock_summary TO authenticated, anon;

-- ============================
-- 6. Triggers de production_requests
-- ============================
CREATE OR REPLACE FUNCTION public.trg_production_request_notify_new()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT
    pr.id,
    'Nueva solicitud de producción bajo demanda',
    'El cliente solicitó ' || NEW.quantity_requested || ' unidad(es) de ' || COALESCE((SELECT name FROM public.products WHERE id = NEW.product_id), 'producto'),
    'REQUEST'
  FROM public.profiles pr
  WHERE pr.role IN ('admin', 'operario');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_production_request_new ON public.production_requests;
CREATE TRIGGER trg_production_request_new
  AFTER INSERT ON public.production_requests
  FOR EACH ROW
  WHEN (NEW.status = 'PROPOSAL')
  EXECUTE FUNCTION public.trg_production_request_notify_new();

CREATE OR REPLACE FUNCTION public.trg_production_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
BEGIN
  SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;

  -- PROPOSAL -> PENDING_PRODUCTION: notificar al cliente que su pago fue validado
  IF OLD.status = 'PROPOSAL' AND NEW.status = 'PENDING_PRODUCTION' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.customer_id,
      'Pago validado',
      'Tu anticipo para ' || COALESCE(v_product_name, 'el producto') || ' fue validado. Iniciaremos la producción.',
      'REQUEST'
    );
  END IF;

  -- PENDING_PRODUCTION -> IN_PRODUCTION
  IF OLD.status = 'PENDING_PRODUCTION' AND NEW.status = 'IN_PRODUCTION' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.customer_id,
      'Producción iniciada',
      'Tu pedido de ' || COALESCE(v_product_name, 'producto') || ' entró a producción.',
      'REQUEST'
    );
  END IF;

  -- IN_PRODUCTION -> COMPLETED: insertar INGRESO reservado y notificar
  IF OLD.status = 'IN_PRODUCTION' AND NEW.status = 'COMPLETED' THEN
    IF EXISTS (
      SELECT 1 FROM public.inventory_ledger
      WHERE reference_type = 'PRODUCCION_DEMANDA'
        AND reference_id = NEW.id
        AND movement_type = 'INGRESO'
    ) THEN
      RAISE EXCEPTION 'La solicitud % ya tiene un ingreso de producción registrado', NEW.id;
    END IF;

    INSERT INTO public.inventory_ledger (
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reference_type,
      reference_id,
      reserved_for_user_id,
      notes,
      created_by
    )
    SELECT
      NEW.product_id,
      'INGRESO',
      NEW.quantity_requested / NULLIF(p.conversion_factor, 0),
      COALESCE(p.cost_per_unit, 0),
      'PRODUCCION_DEMANDA',
      NEW.id,
      NEW.customer_id,
      'Producción bajo demanda — solicitud ' || LEFT(NEW.id::TEXT, 8),
      auth.uid()
    FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.type = 'PRODUCTO_TERMINADO';

    IF NEW.fulfillment_type = 'PICK-UP_IN_PLANT' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.customer_id,
        'Pedido exclusivo listo',
        'Tu pedido de ' || COALESCE(v_product_name, 'producto') || ' está listo. Acércate al kiosko para pagar el saldo y retirar tu producto.',
        'REQUEST'
      );
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.customer_id,
        'Pedido exclusivo listo',
        'Tu pedido de ' || COALESCE(v_product_name, 'producto') || ' está listo. Coordinaremos el envío una vez confirmado el pago del saldo.',
        'REQUEST'
      );
    END IF;
  END IF;

  -- Cualquier -> REJECTED
  IF NEW.status = 'REJECTED' AND OLD.status != 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.customer_id,
      'Solicitud rechazada',
      'Tu solicitud de ' || COALESCE(v_product_name, 'producto') || ' fue rechazada. Motivo: ' || COALESCE(NEW.rejection_reason, 'No especificado'),
      'ALERT'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_production_request_status_change ON public.production_requests;
CREATE TRIGGER trg_production_request_status_change
  AFTER UPDATE ON public.production_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_production_request_status_change();

-- ============================
-- 7. RPC: liquidar saldo de una solicitud
-- ============================
CREATE OR REPLACE FUNCTION public.settle_production_request_balance(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_physical_qty NUMERIC;
BEGIN
  SELECT * INTO v_request
  FROM public.production_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_request.status != 'COMPLETED' THEN
    RAISE EXCEPTION 'La solicitud debe estar en estado COMPLETED para liquidar el saldo';
  END IF;

  IF v_request.balance_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'El saldo de esta solicitud ya fue liquidado';
  END IF;

  v_physical_qty := v_request.quantity_requested / NULLIF((SELECT conversion_factor FROM public.products WHERE id = v_request.product_id), 0);

  -- Consumir stock reservado
  INSERT INTO public.inventory_ledger (
    product_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    created_by
  ) VALUES (
    v_request.product_id,
    'EGRESO',
    v_physical_qty,
    'VENTA_DEMANDA',
    v_request.id,
    'Liquidación de saldo — solicitud ' || LEFT(v_request.id::TEXT, 8),
    auth.uid()
  );

  UPDATE public.production_requests
  SET balance_paid_at = now(),
      updated_at = now(),
      amount_paid = total_amount
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================
-- 8. RLS
-- ============================
ALTER TABLE public.production_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- production_requests
DROP POLICY IF EXISTS "production_requests_select_own" ON public.production_requests;
CREATE POLICY "production_requests_select_own"
  ON public.production_requests FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'operario')
  );

DROP POLICY IF EXISTS "production_requests_insert_own" ON public.production_requests;
CREATE POLICY "production_requests_insert_own"
  ON public.production_requests FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "production_requests_update_staff" ON public.production_requests;
CREATE POLICY "production_requests_update_staff"
  ON public.production_requests FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'operario'));

-- notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'operario')
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
