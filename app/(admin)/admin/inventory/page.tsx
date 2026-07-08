"use client";

import { useState } from "react";
import {
  StockSummaryTable,
  InventoryLedgerTable,
  StockEntryForm,
  InventoryReportButton,
} from "@features/inventory/components";
import { SegmentedControl, type SegmentedColor } from "@shared/components/ui/segmented-control";
import { Wheat, FlaskConical, Box, Layers, Tag, Archive } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StockSegment =
  | "MATERIA_PRIMA"
  | "INSUMO"
  | "ENVASE_EMPAQUE"
  | "PRODUCTO_A_GRANEL"
  | "PRODUCTO_TERMINADO"
  | "MATERIAL_SECUNDARIO";

const SEGMENT_META: Record<StockSegment, { label: string; colorKey: SegmentedColor; Icon: LucideIcon }> = {
  MATERIA_PRIMA:      { label: "Materias Primas", colorKey: "blue",   Icon: Wheat },
  INSUMO:             { label: "Insumos",        colorKey: "purple", Icon: FlaskConical },
  ENVASE_EMPAQUE:     { label: "Envases",        colorKey: "amber",  Icon: Box },
  PRODUCTO_A_GRANEL:   { label: "A Granel",       colorKey: "teal",   Icon: Layers },
  PRODUCTO_TERMINADO:  { label: "Terminados",     colorKey: "brand",  Icon: Tag },
  MATERIAL_SECUNDARIO: { label: "Otros",          colorKey: "zinc",   Icon: Archive },
};

const SEGMENT_ORDER: StockSegment[] = [
  "MATERIA_PRIMA",
  "INSUMO",
  "ENVASE_EMPAQUE",
  "PRODUCTO_A_GRANEL",
  "PRODUCTO_TERMINADO",
  "MATERIAL_SECUNDARIO",
];

export default function AdminInventoryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeSegment, setActiveSegment] = useState<StockSegment>("PRODUCTO_TERMINADO");

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 print:hidden">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Inventario (Bodega)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestión de inventario con doble entrada. Todos los movimientos son
              registros inmutables.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <InventoryReportButton />
          </div>
        </div>

        {/* Formulario ingreso de stock */}
        <div className="print:hidden">
          <StockEntryForm onSuccessAction={handleRefresh} />
        </div>

        {/* Section selector — filtro de niveles de stock por tipo de producto */}
        <div className="flex justify-center print:hidden">
          <SegmentedControl<StockSegment>
            options={SEGMENT_ORDER.map((v) => ({
              value: v,
              label: SEGMENT_META[v].label,
              icon: SEGMENT_META[v].Icon,
              color: SEGMENT_META[v].colorKey,
            }))}
            value={activeSegment}
            onChange={setActiveSegment}
            ariaLabel="Filtro de stock por tipo de producto"
          />
        </div>

        {/* Tabla de stock — filtrada por segmento activo */}
        <StockSummaryTable
          refreshTrigger={refreshTrigger}
          onRefreshAction={handleRefresh}
          filterType={activeSegment}
        />

        {/* Ledger de movimientos — siempre generalizado, con sus filtros */}
        <InventoryLedgerTable refreshTrigger={refreshTrigger} />
      </div>
    </>
  );
}
