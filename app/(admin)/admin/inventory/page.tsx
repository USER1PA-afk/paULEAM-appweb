"use client";

import { useState } from "react";
import {
  StockSummaryTable,
  InventoryLedgerTable,
  StockEntryForm,
  InventoryReportButton,
} from "@features/inventory/components";

export default function AdminInventoryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

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
          <StockEntryForm onSuccessAction={handleRefresh} />
        </div>

        {/* Tabla de stock */}
        <StockSummaryTable refreshTrigger={refreshTrigger} onRefreshAction={handleRefresh} />

        {/* Ledger de movimientos */}
        <InventoryLedgerTable refreshTrigger={refreshTrigger} />
      </div>
    </>
  );
}
