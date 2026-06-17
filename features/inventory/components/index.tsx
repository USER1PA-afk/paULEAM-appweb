"use client";

import { useStockSummary, useInventoryLedger, useInventoryActions, useRealtimeStock } from "@features/inventory/hooks";
import { useSuppliers } from "@features/suppliers/hooks";
import { useState, useEffect, useCallback, Fragment, useMemo } from "react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
import { SearchableSelect } from "@shared/components/ui/searchable-select";
import { getInsforge } from "@shared/lib/insforge/client";
import { RefreshCw, Zap, PackagePlus, FileDown, Handshake as HandshakeIcon, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Package, Hash } from "lucide-react";

interface ProductSupplierLink {
  supplier_id: string;
  is_primary: boolean;
  supplier: { id: string; name: string; company: string | null };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  type: string;
  cost_per_unit: number;
  productSuppliers: ProductSupplierLink[];
}

/**
 * Tabla de resumen de stock actual por producto con Realtime.
 */
function StockSubTable({
  items,
  label,
  accentColor,
}: {
  items: { product_id: string; sku: string; name: string; unit: string; stock_actual: number; min_stock_alert: number | null }[];
  label: string;
  accentColor: string;
}) {
  const { page, setPage, paged, from, to, total, totalPages } = usePagination(items);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accentColor}`} />
        <h4 className="text-sm font-semibold tracking-tight">{label}</h4>
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/60 bg-muted rounded-full px-1.5 py-px">{items.length}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70 shadow-sm">
        <table aria-label={label} className="w-full min-w-[420px] text-sm table-fixed">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[40%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">SKU</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">Producto</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">Stock</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden sm:table-cell">Unidad</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground/60">
                  Sin productos registrados
                </td>
              </tr>
            ) : (
              paged.map((item) => {
                const stock = Number(item.stock_actual);
                const alertThreshold = item.min_stock_alert ?? 0;
                const isLow = stock > 0 && stock <= alertThreshold;
                const statusColor = stock <= 0
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                  : isLow
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
                const statusLabel = stock <= 0 ? "Sin stock" : isLow ? "Stock bajo" : "OK";

                return (
                  <tr key={item.product_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                      stock <= 0 ? "text-rose-600 dark:text-rose-400" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}>
                      {stock.toLocaleString("es-EC", {
                        minimumFractionDigits: ["kg", "lt"].includes(item.unit?.toLowerCase()) ? 2 : 0,
                        maximumFractionDigits: ["kg", "lt"].includes(item.unit?.toLowerCase()) ? 2 : 2,
                        useGrouping: false
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          from={from}
          to={to}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

export function StockSummaryTable({
  refreshTrigger,
  onRefreshAction,
}: {
  refreshTrigger?: number;
  onRefreshAction?: () => void;
}) {
  const { summary, loading, error, refetch } = useStockSummary();
  const [pulse, setPulse] = useState<string | null>(null);

  const handleUpdate = useCallback(() => {
    if (onRefreshAction) {
      onRefreshAction();
    } else {
      refetch();
    }
    setPulse(Date.now().toString());
    setTimeout(() => setPulse(null), 2000);
  }, [refetch, onRefreshAction]);

  const { connected } = useRealtimeStock(handleUpdate);

  useEffect(() => {
    if (refreshTrigger) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const handleManualRefresh = () => {
    if (onRefreshAction) {
      onRefreshAction();
    } else {
      refetch();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando stock...">
        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="skeleton h-2 w-2 rounded-full" />
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-3.5 w-6 rounded-full" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/70 shadow-sm">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40">
                    {["SKU","Producto","Stock","Unidad","Estado"].map((h) => (
                      <th key={h} className="px-4 py-2.5">
                        <div className="skeleton h-2.5 w-12 mx-auto" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {Array.from({ length: 4 }).map((_, ri) => (
                    <tr key={ri}>
                      <td className="px-4 py-3"><div className="skeleton h-3.5 w-16" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-3.5 w-36" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-3.5 w-12 ml-auto" /></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><div className="skeleton h-3.5 w-10" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-5 w-14 mx-auto rounded-full" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const rawMaterials = summary.filter((i) => i.type === "MATERIA_PRIMA");
  const supplies     = summary.filter((i) => i.type === "INSUMO");
  const packaging    = summary.filter((i) => i.type === "ENVASE_EMPAQUE");
  const bulkGoods    = summary.filter((i) => i.type === "PRODUCTO_A_GRANEL");
  const finished     = summary.filter((i) => i.type === "PRODUCTO_TERMINADO");
  const other        = summary.filter((i) => !["MATERIA_PRIMA","INSUMO","ENVASE_EMPAQUE","PRODUCTO_A_GRANEL","PRODUCTO_TERMINADO"].includes(i.type ?? ""));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold tracking-tight">Stock Actual</h3>
          <span
            aria-label={connected ? "Stock en vivo activo" : "Sin conexión realtime"}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
          >
            <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-brand-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            <span className={connected ? "text-brand-600" : "text-muted-foreground"}>
              {connected ? "En vivo" : "Estático"}
            </span>
          </span>
        </div>
        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {pulse && (
        <div role="status" aria-live="polite" className="flex items-center gap-1.5 rounded-md bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 animate-pulse dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300">
          <Zap aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> Movimiento detectado — stock actualizado
        </div>
      )}

      {rawMaterials.length > 0 && <StockSubTable items={rawMaterials} label="Materias Primas" accentColor="bg-blue-500" />}
      {supplies.length > 0     && <StockSubTable items={supplies}     label="Insumos / Auxiliares" accentColor="bg-purple-500" />}
      {packaging.length > 0    && <StockSubTable items={packaging}    label="Envases y Empaques" accentColor="bg-amber-500" />}
      {bulkGoods.length > 0    && <StockSubTable items={bulkGoods}    label="Productos a Granel" accentColor="bg-teal-500" />}
      {finished.length > 0     && <StockSubTable items={finished}     label="Productos Terminados" accentColor="bg-brand-500" />}
      {other.length > 0        && <StockSubTable items={other}        label="Otros" accentColor="bg-zinc-400" />}
      {summary.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">Sin movimientos de stock registrados</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Registra el primer ingreso de materia prima usando el formulario de arriba.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Formulario de Ingreso de Stock (movimiento INGRESO en ledger).
 * Cuando tipo = COMPRA, requiere selección de proveedor.
 */
export function StockEntryForm({ onSuccessAction }: { onSuccessAction?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { registerMovement, loading, error } = useInventoryActions();
  const { suppliers } = useSuppliers();
  const insforge = getInsforge();

  const [form, setForm] = useState({
    product_id: "",
    quantity: "",
    unit_cost: "",
    notes: "",
    reference_type: "COMPRA",
    supplier_id: "",
  });

  useEffect(() => {
    insforge.database
      .from("products")
      .select("id, name, sku, unit, type, cost_per_unit, productSuppliers:product_suppliers(supplier_id, is_primary, supplier:suppliers(id, name, company))")
      .eq("is_active", true)
      .order("name")
      .then(
        ({ data }) => setProducts((data as unknown as Product[]) ?? []),
        () => {}
      );
  }, [insforge]);

  // Cuando cambia el tipo de movimiento, limpiar proveedor si no es COMPRA
  function handleRefTypeChange(val: string) {
    setForm((p) => ({
      ...p,
      reference_type: val,
      supplier_id: val === "COMPRA" ? p.supplier_id : "",
    }));
  }

  // Tipos que se pueden comprar externamente y tener proveedor
  const PURCHASABLE = ["MATERIA_PRIMA", "INSUMO", "ENVASE_EMPAQUE", "MATERIAL_SECUNDARIO"];

  const productOptions = useMemo(() => {
    const TYPE_LABELS: Record<string, string> = {
      MATERIA_PRIMA: "Materias Primas",
      INSUMO: "Insumos",
      ENVASE_EMPAQUE: "Envases y Empaques",
      MATERIAL_SECUNDARIO: "Materiales Secundarios",
      PRODUCTO_A_GRANEL: "Productos a Granel",
      PRODUCTO_TERMINADO: "Productos Terminados",
      OTRO: "Otros",
    };
    return products.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.sku})`,
      meta: p.unit,
      group: TYPE_LABELS[p.type] ?? p.type,
    }));
  }, [products]);

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const selectedUnit = selectedProduct?.unit?.toLowerCase() || "";
  const isPurchasable = PURCHASABLE.includes(selectedProduct?.type ?? "");
  const isGranel     = selectedProduct?.type === "PRODUCTO_A_GRANEL";
  const isTerminado  = selectedProduct?.type === "PRODUCTO_TERMINADO";

  let minQty = "0.01";
  let stepQty = "0.01";
  if (["unidad", "unidades", "libra", "libras", "unit", "units", "lb", "lbs"].includes(selectedUnit)) {
    minQty = "1";
    stepQty = "1";
  }

  const isCompra = form.reference_type === "COMPRA";
  const requiresSupplier = isCompra && isPurchasable;

  // Opciones de tipo de movimiento según el tipo de producto seleccionado
  const refTypeOptions: { value: string; label: string }[] = isPurchasable
    ? [
        { value: "COMPRA",     label: "Compra a proveedor" },
        { value: "AJUSTE",     label: "Ajuste de inventario" },
        { value: "DEVOLUCION", label: "Devolución" },
      ]
    : isGranel
    ? [{ value: "AJUSTE", label: "Ajuste de inventario" }]
    : isTerminado
    ? [{ value: "AJUSTE", label: "Ajuste de inventario" }]
    : [
        { value: "COMPRA",     label: "Compra a proveedor" },
        { value: "AJUSTE",     label: "Ajuste de inventario" },
        { value: "DEVOLUCION", label: "Devolución" },
      ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (requiresSupplier && !form.supplier_id) {
      return; // El required en el select lo bloquea también
    }

    const result = await registerMovement({
      product_id: form.product_id,
      quantity: Number(form.quantity),
      unit_cost: form.unit_cost ? Number(form.unit_cost) : 0,
      movement_type: "INGRESO",
      reference_type: form.reference_type,
      supplier_id: form.supplier_id || undefined,
      notes: form.notes || undefined,
    });

    if (!result.error) {
      setForm({ product_id: "", quantity: "", unit_cost: "", notes: "", reference_type: "COMPRA", supplier_id: "" });
      setShowForm(false);
      const product = products.find((p) => p.id === form.product_id);
      setSuccess(`Ingreso registrado: ${form.quantity} ${product?.unit ?? ""} de ${product?.name ?? ""}`);
      setTimeout(() => setSuccess(null), 5000);
      onSuccessAction?.();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Ingreso de Stock</h3>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setSuccess(null);
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors w-full sm:w-auto"
        >
          {showForm ? "Cancelar" : <span className="inline-flex items-center gap-1.5 justify-center"><PackagePlus aria-hidden="true" className="h-4 w-4" /> Nuevo Ingreso</span>}
        </button>
      </div>

      {success && (
        <div role="status" aria-live="polite" className="rounded-md bg-brand-50 border border-brand-200 px-4 py-3 text-sm font-medium text-brand-700">
          {success}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Producto */}
            <div className="space-y-1.5 lg:col-span-1 min-w-0">
              <label htmlFor="entry-product" className="text-xs font-medium text-muted-foreground">
                Producto *
              </label>
              <SearchableSelect
                id="entry-product"
                required
                options={productOptions}
                value={form.product_id}
                onChange={(val) => {
                  const prod = products.find((pr) => pr.id === val);
                  const pType = prod?.type ?? "";
                  const nonPurchasable = ["PRODUCTO_A_GRANEL", "PRODUCTO_TERMINADO"].includes(pType);
                  const isPurchasableType = PURCHASABLE.includes(pType);
                  const primary = prod?.productSuppliers?.find((ps) => ps.is_primary);
                  const firstSupplier = prod?.productSuppliers?.[0];
                  const autoSupplier = primary ?? firstSupplier;
                  setForm((p) => ({
                    ...p,
                    product_id: val,
                    supplier_id: autoSupplier?.supplier_id ?? "",
                    reference_type: nonPurchasable ? "AJUSTE" : p.reference_type,
                    unit_cost: isPurchasableType && prod?.cost_per_unit
                      ? String(prod.cost_per_unit)
                      : "",
                  }));
                }}
                placeholder="Seleccionar producto..."
                searchPlaceholder="Escriba para buscar..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Cantidad */}
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="entry-qty" className="text-xs font-medium text-muted-foreground">
                Cantidad *
              </label>
              <input
                id="entry-qty"
                type="number"
                required
                min={minQty}
                step={stepQty}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="Ej: 50"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Costo Unitario */}
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="entry-cost" className="text-xs font-medium text-muted-foreground">
                Costo Unitario (USD)
              </label>
              <input
                id="entry-cost"
                type="number"
                min="0"
                step="0.0001"
                value={form.unit_cost}
                onChange={(e) => setForm((p) => ({ ...p, unit_cost: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Tipo de referencia */}
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="entry-ref" className="text-xs font-medium text-muted-foreground">
                Tipo de Movimiento
                {(isGranel || isTerminado) && (
                  <span className="ml-1 text-[10px] text-amber-600">
                    — {isGranel ? "usa módulo Producción" : "usa módulo Empaque"}
                  </span>
                )}
              </label>
              <select
                id="entry-ref"
                value={form.reference_type}
                onChange={(e) => handleRefTypeChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {refTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Proveedor — visible solo cuando tipo = COMPRA y producto es comprable */}
            {isCompra && isPurchasable && (
              <div className="space-y-1.5 min-w-0">
                <label htmlFor="entry-supplier" className="text-xs font-medium text-muted-foreground">
                  Proveedor *
                </label>
                <select
                  id="entry-supplier"
                  required={requiresSupplier}
                  value={form.supplier_id}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {selectedProduct?.productSuppliers?.length
                    ? selectedProduct.productSuppliers.map((ps) => (
                        <option key={ps.supplier_id} value={ps.supplier_id}>
                          {ps.supplier.company ?? ps.supplier.name}
                          {ps.is_primary ? " (principal)" : ""}
                        </option>
                      ))
                    : suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company ?? s.name}
                        </option>
                      ))}
                </select>
                {selectedProduct?.productSuppliers?.length === 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Este producto no tiene proveedores vinculados. Asigna uno en Productos.
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            <div className={`space-y-1.5 min-w-0 ${isCompra ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2 lg:col-span-2"}`}>
              <label htmlFor="entry-notes" className="text-xs font-medium text-muted-foreground">
                Notas
              </label>
              <input
                id="entry-notes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Número de factura, observaciones..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
            >
              {loading ? "Registrando..." : "Registrar Ingreso"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full sm:w-auto"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const REF_TYPES = ["COMPRA", "AJUSTE", "DEVOLUCION", "PRODUCCION", "EMPAQUE", "MERMA"] as const;

interface LedgerEntry {
  id: string;
  product_id: string;
  movement_type: "INGRESO" | "EGRESO";
  quantity: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  supplier_company: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_unit: string | null;
  production_recipe_name: string | null;
  notes: string | null;
  created_at: string;
}

type DisplayItem =
  | { kind: "entry"; entry: LedgerEntry }
  | { kind: "group"; referenceId: string; entries: LedgerEntry[]; date: string; recipeName: string | null };

function buildDisplayItems(entries: LedgerEntry[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const seenGroups = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const isGroupable = (entry.reference_type === "PRODUCCION" || entry.reference_type === "EMPAQUE") && entry.reference_id;
    if (isGroupable) {
      const key = entry.reference_id!;
      if (!seenGroups.has(key)) {
        const groupEntries: LedgerEntry[] = [];
        seenGroups.set(key, groupEntries);
        items.push({ kind: "group", referenceId: key, entries: groupEntries, date: entry.created_at, recipeName: entry.production_recipe_name ?? null });
      }
      seenGroups.get(key)!.push(entry);
    } else {
      items.push({ kind: "entry", entry });
    }
  }
  // Within each production group: EGRESOs (raw materials) first, INGRESOs (finished product) last.
  for (const group of seenGroups.values()) {
    group.sort((a, b) => {
      if (a.movement_type === b.movement_type) return 0;
      return a.movement_type === "EGRESO" ? -1 : 1;
    });
  }
  return items;
}

export function InventoryLedgerTable({
  productId,
  refreshTrigger,
}: {
  productId?: string;
  refreshTrigger?: number;
}) {
  const { entries, loading, error, refetch } = useInventoryLedger(productId);
  const [movType, setMovType] = useState("");
  const [refType, setRefType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (refreshTrigger) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const filtered = (entries as LedgerEntry[]).filter((e) => {
    if (movType && e.movement_type !== movType) return false;
    if (refType && e.reference_type !== refType) return false;
    if (dateFrom && new Date(e.created_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(e.created_at) > end) return false;
    }
    return true;
  });
  const displayItems = buildDisplayItems(filtered);
  const { page, setPage, paged: shownItems, from, to, total: totalDisplayItems, totalPages } = usePagination(displayItems);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [movType, refType, dateFrom, dateTo]);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Cargando movimientos...">
        <div className="skeleton h-5 w-40" />
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Fecha","Producto","Tipo","Cantidad","Referencia"].map((h) => (
                  <th key={h} className="px-4 py-3">
                    <div className="skeleton h-3 w-16 mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-32" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-5 w-16 mx-auto rounded-full" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-14 ml-auto" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-20 mx-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const hasActiveFilter = movType || refType || dateFrom || dateTo;

  const fmtQty = (n: number, unit?: string | null) => {
    const isPhysical = ["kg", "lt"].includes(unit?.toLowerCase() || "");
    return Number(n).toLocaleString("es-EC", {
      minimumFractionDigits: isPhysical ? 2 : 0,
      maximumFractionDigits: isPhysical ? 2 : 2,
      useGrouping: false,
    });
  };
  const fmtCost = (n: number) =>
    Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <div className="space-y-3">
      {/* Header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold tracking-tight">Movimientos de Inventario</h3>
        {hasActiveFilter && (
          <button
            onClick={() => { setMovType(""); setRefType(""); setDateFrom(""); setDateTo(""); }}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={movType}
          onChange={(e) => setMovType(e.target.value)}
          aria-label="Filtrar por tipo de movimiento"
          className="h-7 rounded-full border border-border bg-background px-3 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-foreground/30"
        >
          <option value="">Todos los tipos</option>
          <option value="INGRESO">↑ Ingreso</option>
          <option value="EGRESO">↓ Egreso</option>
        </select>

        <select
          value={refType}
          onChange={(e) => setRefType(e.target.value)}
          aria-label="Filtrar por origen"
          className="h-7 rounded-full border border-border bg-background px-3 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-foreground/30"
        >
          <option value="">Todos los orígenes</option>
          {REF_TYPES.map((r) => {
            const labels: Record<string, string> = {
              COMPRA: "Compra",
              AJUSTE: "Ajuste",
              DEVOLUCION: "Devolución",
              PRODUCCION: "Producción",
              EMPAQUE: "Empaque",
              MERMA: "Merma",
            };
            return <option key={r} value={r}>{labels[r] ?? r}</option>;
          })}
        </select>

        {/* Date range — wraps to its own line on mobile */}
        <div className="flex items-center gap-1.5 sm:ml-auto w-full sm:w-auto">
          <label htmlFor="ledger-from" className="text-[11px] text-muted-foreground shrink-0">Desde</label>
          <input id="ledger-from" type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined}
            className="h-7 flex-1 sm:flex-none rounded-full border border-border bg-background px-2.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-ring min-w-0"
          />
          <span className="text-muted-foreground/40 text-[11px] shrink-0">—</span>
          <input id="ledger-to" type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined}
            className="h-7 flex-1 sm:flex-none rounded-full border border-border bg-background px-2.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-ring min-w-0"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/70 shadow-sm">
        <table aria-label="Movimientos de inventario" className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-36">Fecha</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-48">Movimiento</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">Cantidad</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden sm:table-cell">Costo</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden md:table-cell">Proveedor</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden lg:table-cell">Notas</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-24">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {shownItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground/60">
                  {hasActiveFilter ? "Sin resultados para los filtros aplicados" : "Sin movimientos registrados"}
                </td>
              </tr>
            ) : (
              shownItems.map((item) => {
                if (item.kind === "group") {
                  const expanded = expandedGroups.has(item.referenceId);
                  const dt = fmtDateTime(item.date);
                  return (
                    <Fragment key={item.referenceId}>
                      {/* Production group header */}
                      <tr
                        className={`border-l-[3px] cursor-pointer transition-colors ${
                          (item.entries[0]?.reference_type === "EMPAQUE")
                            ? "border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/30"
                            : "border-l-violet-400 bg-violet-50/40 dark:bg-violet-950/20 hover:bg-violet-50/70 dark:hover:bg-violet-950/30"
                        }`}
                        onClick={() => toggleGroup(item.referenceId)}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col leading-none">
                            <span className="text-xs font-semibold text-foreground tabular-nums">{dt.date}</span>
                            <span className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">{dt.time}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`inline-grid place-items-center h-5 w-5 rounded-md shrink-0 ${
                              item.entries[0]?.reference_type === "EMPAQUE"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                                : "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"
                            }`}>
                              {expanded
                                ? <ChevronDown aria-hidden="true" className="h-3 w-3" />
                                : <ChevronRight aria-hidden="true" className="h-3 w-3" />}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${
                                  item.entries[0]?.reference_type === "EMPAQUE"
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-violet-700 dark:text-violet-300"
                                }`}>
                                  {item.entries[0]?.reference_type === "EMPAQUE" ? "Empaque" : "Producción"}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                                  item.entries[0]?.reference_type === "EMPAQUE"
                                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
                                    : "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400"
                                }`}>
                                  {item.entries.length}
                                </span>
                              </div>
                              {item.recipeName && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{item.recipeName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground/50">—</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-right text-xs text-muted-foreground/50">—</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground/50">—</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground/50">—</td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground/30">—</td>
                      </tr>

                      {/* Expanded sub-rows */}
                      {expanded && item.entries.map((entry) => (
                        <tr key={entry.id}
                          className="border-l-[3px] border-l-violet-200 dark:border-l-violet-800 bg-violet-50/20 dark:bg-violet-950/10 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition-colors"
                        >
                          <td className="pl-9 pr-4 py-2.5">
                            <span aria-hidden="true" className="text-[10px] text-muted-foreground/30 select-none">└</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`inline-grid place-items-center h-4 w-4 rounded shrink-0 ${
                                entry.movement_type === "INGRESO"
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600"
                                  : "bg-rose-100 dark:bg-rose-950/50 text-rose-600"
                              }`}>
                                {entry.movement_type === "INGRESO"
                                  ? <ArrowUp aria-hidden="true" className="h-2.5 w-2.5" />
                                  : <ArrowDown aria-hidden="true" className="h-2.5 w-2.5" />}
                              </span>
                              <div>
                                <p className="text-xs font-medium text-foreground leading-none">{entry.product_name ?? "—"}</p>
                                {entry.product_sku && (
                                  <p className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 leading-none">{entry.product_sku}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono text-xs font-semibold tabular-nums ${
                              entry.movement_type === "INGRESO" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}>
                              {entry.movement_type === "EGRESO" ? "−" : "+"}{fmtQty(entry.quantity, entry.product_unit)}
                            </span>
                            {entry.product_unit && (
                              <span className="ml-1 text-[10px] text-muted-foreground/50">{entry.product_unit}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-right text-xs text-muted-foreground/40">—</td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground/40">—</td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground/60 max-w-[200px] truncate">
                            {entry.notes ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-muted-foreground/30">—</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }

                // Flat entry
                const entry = item.entry;
                const dt = fmtDateTime(entry.created_at);
                const isIn = entry.movement_type === "INGRESO";
                const isEntryExpanded = expandedEntries.has(entry.id);
                const totalCost = entry.unit_cost > 0 ? entry.unit_cost * entry.quantity : null;
                return (
                  <Fragment key={entry.id}>
                    <tr
                      className={`transition-colors border-l-[3px] ${
                        isEntryExpanded
                          ? isIn
                            ? "border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10"
                            : "border-l-rose-400 bg-rose-50/30 dark:bg-rose-950/10"
                          : "border-l-transparent hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col leading-none">
                          <span className="text-xs font-semibold text-foreground tabular-nums">{dt.date}</span>
                          <span className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">{dt.time}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isIn
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}>
                            {isIn
                              ? <ArrowUp aria-hidden="true" className="h-2.5 w-2.5" />
                              : <ArrowDown aria-hidden="true" className="h-2.5 w-2.5" />}
                            {isIn ? "Ingreso" : "Egreso"}
                          </span>
                          {entry.reference_type && (
                            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">{entry.reference_type}</span>
                          )}
                        </div>
                        {entry.product_name && (
                          <p className="mt-1 text-[11px] text-muted-foreground/70 font-medium leading-none pl-0.5 truncate max-w-[160px]">{entry.product_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm font-semibold tabular-nums ${
                          isIn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {isIn ? "+" : "−"}{fmtQty(entry.quantity, entry.product_unit)}
                        </span>
                        {entry.product_unit && (
                          <span className="ml-1 text-[10px] text-muted-foreground/50">{entry.product_unit}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                        {entry.unit_cost > 0 ? fmtCost(entry.unit_cost) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {entry.supplier_company ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-300">
                            <HandshakeIcon aria-hidden="true" className="h-3 w-3 shrink-0" /> {entry.supplier_company}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground/60 max-w-[200px] truncate hidden lg:table-cell">
                        {entry.notes ?? <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleEntry(entry.id)}
                          aria-expanded={isEntryExpanded}
                          aria-label={isEntryExpanded ? "Ocultar detalle del movimiento" : "Ver detalle del movimiento"}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                            isEntryExpanded
                              ? "bg-muted text-foreground"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {isEntryExpanded
                            ? <ChevronDown aria-hidden="true" className="h-3 w-3" />
                            : <ChevronRight aria-hidden="true" className="h-3 w-3" />}
                          {isEntryExpanded ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail sub-row */}
                    {isEntryExpanded && (
                      <tr className={`border-l-[3px] ${
                        isIn
                          ? "border-l-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10"
                          : "border-l-rose-300 bg-rose-50/20 dark:bg-rose-950/10"
                      }`}>
                        <td colSpan={7} className="px-6 pb-4 pt-2">
                          <div className="rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm p-4 shadow-sm">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                              {/* Product */}
                              <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Package aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Producto</p>
                                  <p className="text-sm font-semibold text-foreground leading-tight mt-0.5">{entry.product_name ?? "—"}</p>
                                  {entry.product_sku && (
                                    <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{entry.product_sku}</p>
                                  )}
                                  {entry.product_unit && (
                                    <span className="inline-block mt-1 rounded-full bg-muted px-1.5 py-px text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wide">{entry.product_unit}</span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity & cost breakdown */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Cantidad / Costo</p>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Cantidad</span>
                                    <span className={`font-mono text-xs font-bold tabular-nums ${
                                      isIn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                    }`}>
                                      {isIn ? "+" : "−"}{fmtQty(entry.quantity, entry.product_unit)} {entry.product_unit}
                                    </span>
                                  </div>
                                  {entry.unit_cost > 0 && (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Costo unitario</span>
                                        <span className="font-mono text-xs tabular-nums text-foreground">{fmtCost(entry.unit_cost)}</span>
                                      </div>
                                      {totalCost !== null && (
                                        <div className="flex items-center justify-between border-t border-border/50 pt-1">
                                          <span className="text-xs font-semibold text-foreground">Total</span>
                                          <span className="font-mono text-xs font-bold tabular-nums text-foreground">{fmtCost(totalCost)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Origin / Supplier */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Origen</p>
                                <div className="space-y-1.5">
                                  {entry.reference_type && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        {entry.reference_type}
                                      </span>
                                    </div>
                                  )}
                                  {entry.supplier_company && (
                                    <div className="flex items-center gap-1.5">
                                      <HandshakeIcon aria-hidden="true" className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                                      <span className="text-xs font-medium text-foreground">{entry.supplier_company}</span>
                                    </div>
                                  )}
                                  {!entry.supplier_company && !entry.reference_type && (
                                    <span className="text-xs text-muted-foreground/40">Sin datos de origen</span>
                                  )}
                                </div>
                              </div>

                              {/* Notes & ID */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Notas / Referencia</p>
                                {entry.notes ? (
                                  <p className="text-xs text-foreground leading-relaxed">{entry.notes}</p>
                                ) : (
                                  <p className="text-xs text-muted-foreground/40 italic">Sin notas</p>
                                )}
                                {entry.reference_id && (
                                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono">
                                    <Hash aria-hidden="true" className="h-3 w-3" />
                                    {entry.reference_id.substring(0, 16)}…
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        from={from}
        to={to}
        total={totalDisplayItems}
        onPageChange={setPage}
      />
    </div>
  );
}

/**
 * Botón para exportar el inventario como reporte PDF (window.print).
 */
export function InventoryReportButton() {
  return (
    <button
      onClick={() => {
        window.print();
      }}
      className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors print:hidden flex items-center gap-2"
    >
      <FileDown aria-hidden="true" className="h-4 w-4" /> Exportar PDF
    </button>
  );
}
