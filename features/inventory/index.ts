/**
 * Feature: Inventory (Bodega)
 *
 * Gestión de inventario con doble entrada contable (inventory_ledger).
 * Incluye realtime subscriptions para stock en vivo y formulario de ingreso.
 *
 * Exports:
 * - Components: StockSummaryTable, StockEntryForm, InventoryLedgerTable, InventoryReportButton
 * - Hooks: useStockSummary, useInventoryLedger, useInventoryActions, useRealtimeStock
 */

export {
  StockSummaryTable,
  StockEntryForm,
  InventoryLedgerTable,
  InventoryReportButton,
} from "./components";

export {
  useStockSummary,
  useInventoryLedger,
  useInventoryActions,
  useRealtimeStock,
} from "./hooks";
