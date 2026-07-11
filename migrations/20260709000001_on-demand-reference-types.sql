-- PAuleam ERP — Permitir reference_types para producción bajo demanda
-- en la constraint de whitelist de inventory_ledger.

ALTER TABLE public.inventory_ledger
  DROP CONSTRAINT IF EXISTS inventory_ledger_reference_type_whitelist;

ALTER TABLE public.inventory_ledger
  ADD CONSTRAINT inventory_ledger_reference_type_whitelist
    CHECK (reference_type IS NULL OR reference_type IN (
      'COMPRA','PRODUCCION','PRODUCCION_DEMANDA','VENTA','VENTA_DEMANDA',
      'AJUSTE','EMPAQUE','MERMA','RESERVA','INVENTARIO_FISICO','DEVOLUCION','INICIAL'
    ));
