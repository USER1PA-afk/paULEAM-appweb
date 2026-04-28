import {
  StockSummaryTable,
  InventoryLedgerTable,
  StockEntryForm,
  InventoryReportButton,
} from "@features/inventory/components";

export default function AdminInventoryPage() {
  return (
    <>
      {/* Print header — solo visible al imprimir */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">PAuleam ERP — Reporte de Inventario</h1>
        <p className="text-sm text-gray-500">
          Generado: {new Date().toLocaleString("es-EC")}
        </p>
        <hr className="my-3" />
      </div>

      <div className="space-y-8 print:space-y-6">
        {/* Header — oculto al imprimir */}
        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Inventario (Bodega)
            </h1>
            <p className="mt-1 text-muted-foreground">
              Gestión de inventario con doble entrada. Todos los movimientos son
              registros inmutables.
            </p>
          </div>
          <InventoryReportButton />
        </div>

        {/* Formulario ingreso de stock */}
        <div className="print:hidden">
          <StockEntryForm />
        </div>

        {/* Tabla de stock */}
        <StockSummaryTable />

        {/* Ledger de movimientos */}
        <InventoryLedgerTable />
      </div>
    </>
  );
}
