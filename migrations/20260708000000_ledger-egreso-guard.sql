-- ============================================================
-- PAuleam ERP — Universal EGRESO guard on inventory_ledger
-- ============================================================
-- Root cause for historical negative stock: every caller of
-- inventory_ledger did its own stock check, and the e-commerce
-- path (approveOrder / confirmPickup in checkout/hooks) skipped
-- it entirely. This trigger makes "EGRESO > available" physically
-- impossible regardless of caller.
--
-- Defense in depth: production, packaging, POS, declare_waste,
-- reverse_production and the new fn_finalize_online_order all
-- benefit. The trigger runs AFTER the row is constructed but
-- BEFORE it becomes visible, so failed inserts roll back cleanly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_inventory_ledger_egreso()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  IF NEW.movement_type <> 'EGRESO' THEN
    RETURN NEW;
  END IF;

  v_current := public.get_stock_balance(NEW.product_id);

  IF v_current < NEW.quantity THEN
    RAISE EXCEPTION
      'EGRESO rechazado para producto %: stock actual=%, intento=%, resultante=%. '
      'Verifique disponibilidad antes de continuar.',
      NEW.product_id,
      ROUND(v_current, 4),
      ROUND(NEW.quantity, 4),
      ROUND(v_current - NEW.quantity, 4)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_inventory_ledger_egreso ON public.inventory_ledger;
CREATE TRIGGER trg_guard_inventory_ledger_egreso
  BEFORE INSERT ON public.inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_inventory_ledger_egreso();
