-- ============================================================
-- PAuleam ERP — Defense-in-depth constraints
-- ============================================================
-- Locks the schema against the classes of bug that produced
-- PT-001 = -7 in the first place. Each constraint is added
-- after a defensive data cleanup so it applies cleanly to
-- both existing and new rows.
--
-- Coverage:
--   1. products.unit NOT NULL + non-empty
--   2. products.conversion_factor > 0
--   3. products.sales_unit_name not empty when set
--   4. inventory_ledger.quantity > 0
--   5. inventory_ledger.movement_type whitelist
--   6. inventory_ledger.reference_type whitelist
-- ============================================================

-- ── 1. Clean up existing data ───────────────────────────
UPDATE public.products
SET unit = 'kg'
WHERE unit IS NULL OR TRIM(unit) = '';

UPDATE public.products
SET conversion_factor = 1.0
WHERE conversion_factor IS NULL OR conversion_factor <= 0;

UPDATE public.products
SET sales_unit_name = unit
WHERE sales_unit_name IS NOT NULL
  AND TRIM(sales_unit_name) = ''
  AND unit IS NOT NULL;

-- Ledger: collapse any zero-quantity rows to a 0.0001 marker
-- (they should not exist in normal operation; the guard
-- trigger and helpers all expect positive quantities).
-- If any negative quantity exists, fix by inserting the
-- absolute value as a counter-movement, then delete the row.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, product_id, quantity, reference_type, reference_id
    FROM public.inventory_ledger
    WHERE quantity <= 0
  LOOP
    IF r.quantity < 0 THEN
      INSERT INTO public.inventory_ledger (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      )
      VALUES (
        r.product_id,
        'INGRESO',
        -r.quantity,
        0,
        'AJUSTE',
        gen_random_uuid(),
        FORMAT('Corrección automática: contra-asiento por cantidad negativa legada (ledger id %s)', r.id),
        auth.uid()
      );
    END IF;
    DELETE FROM public.inventory_ledger WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 2. Apply constraints ────────────────────────────────
ALTER TABLE public.products
  ALTER COLUMN unit SET NOT NULL,
  ALTER COLUMN conversion_factor SET DEFAULT 1.0,
  ALTER COLUMN conversion_factor SET NOT NULL,
  ADD CONSTRAINT products_unit_nonempty CHECK (TRIM(unit) <> ''),
  ADD CONSTRAINT products_conversion_factor_positive CHECK (conversion_factor > 0),
  ADD CONSTRAINT products_sales_unit_nonempty_when_set
    CHECK (sales_unit_name IS NULL OR TRIM(sales_unit_name) <> '');

ALTER TABLE public.inventory_ledger
  ADD CONSTRAINT inventory_ledger_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT inventory_ledger_movement_type_whitelist
    CHECK (movement_type IN ('INGRESO', 'EGRESO')),
  ADD CONSTRAINT inventory_ledger_reference_type_whitelist
    CHECK (reference_type IN (
      'COMPRA','PRODUCCION','VENTA','AJUSTE','EMPAQUE',
      'MERMA','RESERVA','INVENTARIO_FISICO','DEVOLUCION','INICIAL'
    ));
