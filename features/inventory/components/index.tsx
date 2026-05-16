"use client";

import { useStockSummary, useInventoryLedger, useInventoryActions, useRealtimeStock } from "@features/inventory/hooks";
import { useSuppliers } from "@features/suppliers/hooks";
import { formatDate } from "@shared/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { RefreshCw, Zap, PackagePlus, FileDown, Handshake as HandshakeIcon, ArrowUp, ArrowDown } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  type: string;
}

/**
 * Tabla de resumen de stock actual por producto con Realtime.
 */
export function StockSummaryTable() {
  const { summary, loading, error, refetch } = useStockSummary();
  const [pulse, setPulse] = useState<string | null>(null);

  // Realtime — actualizaciones en vivo
  const handleUpdate = useCallback(() => {
    refetch();
    setPulse(Date.now().toString());
    setTimeout(() => setPulse(null), 2000);
  }, [refetch]);

  const { connected } = useRealtimeStock(handleUpdate);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando stock...</span>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Stock Actual</h3>
          {/* Indicador de conexión Realtime */}
          <span
            aria-label={connected ? "Stock en vivo activo" : "Sin conexión realtime"}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${
                connected
                  ? "bg-brand-500 animate-pulse"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span className={connected ? "text-brand-600" : "text-muted-foreground"}>
              {connected ? "En vivo" : "Estático"}
            </span>
          </span>
        </div>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {pulse && (
        <div role="status" aria-live="polite" className="flex items-center gap-1.5 rounded-md bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 animate-pulse dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300">
          <Zap aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> Movimiento detectado — stock actualizado
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table aria-label="Resumen de stock actual" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                SKU
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Producto
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                Tipo
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Stock
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                Unidad
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No hay productos registrados
                </td>
              </tr>
            ) : (
              summary.map((item) => {
                const stockNum = Number(item.stock_actual);
                const statusColor =
                  stockNum <= 0
                    ? "bg-red-100 text-red-700"
                    : stockNum < 10
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700";
                const statusLabel =
                  stockNum <= 0 ? "Sin stock" : stockNum < 10 ? "Stock bajo" : "OK";

                return (
                  <tr
                    key={item.product_id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.type === "MATERIA_PRIMA"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.type === "MATERIA_PRIMA"
                          ? "Materia Prima"
                          : "Producto Terminado"}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        stockNum <= 0
                          ? "text-destructive"
                          : stockNum < 10
                          ? "text-warning"
                          : "text-foreground"
                      }`}
                    >
                      {stockNum.toLocaleString("es-EC", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Formulario de Ingreso de Stock (movimiento INGRESO en ledger).
 * Cuando tipo = COMPRA, requiere selección de proveedor.
 */
export function StockEntryForm({ onSuccess }: { onSuccess?: () => void }) {
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
      .select("id, name, sku, unit, type")
      .eq("is_active", true)
      .order("name")
      .then(
        ({ data }) => setProducts((data as Product[]) ?? []),
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

  // Al seleccionar un producto MATERIA_PRIMA, pre-filtrar proveedores disponibles
  const selectedProduct = products.find((p) => p.id === form.product_id);
  const isCompra = form.reference_type === "COMPRA";
  const isMateriaPrima = selectedProduct?.type === "MATERIA_PRIMA";
  const requiresSupplier = isCompra && isMateriaPrima;

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
      onSuccess?.();
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
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancelar" : <span className="inline-flex items-center gap-1.5"><PackagePlus aria-hidden="true" className="h-4 w-4" /> Nuevo Ingreso</span>}
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
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Producto */}
            <div className="space-y-1.5 lg:col-span-1">
              <label htmlFor="entry-product" className="text-xs font-medium text-muted-foreground">
                Producto *
              </label>
              <select
                id="entry-product"
                required
                value={form.product_id}
                onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value, supplier_id: "" }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {p.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div className="space-y-1.5">
              <label htmlFor="entry-qty" className="text-xs font-medium text-muted-foreground">
                Cantidad *
              </label>
              <input
                id="entry-qty"
                type="number"
                required
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="Ej: 50"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Costo Unitario */}
            <div className="space-y-1.5">
              <label htmlFor="entry-cost" className="text-xs font-medium text-muted-foreground">
                Costo Unitario (USD)
              </label>
              <input
                id="entry-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm((p) => ({ ...p, unit_cost: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Tipo de referencia */}
            <div className="space-y-1.5">
              <label htmlFor="entry-ref" className="text-xs font-medium text-muted-foreground">
                Tipo de Movimiento
              </label>
              <select
                id="entry-ref"
                value={form.reference_type}
                onChange={(e) => handleRefTypeChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="COMPRA">Compra a proveedor</option>
                <option value="AJUSTE">Ajuste de inventario</option>
                <option value="DEVOLUCION">Devolución</option>
                <option value="PRODUCCION">Producción</option>
              </select>
            </div>

            {/* Proveedor — visible solo cuando tipo = COMPRA y producto = MATERIA_PRIMA */}
            {isCompra && (
              <div className="space-y-1.5">
                <label htmlFor="entry-supplier" className="text-xs font-medium text-muted-foreground">
                  Proveedor {requiresSupplier ? "*" : ""}
                  {!isMateriaPrima && isCompra && (
                    <span className="ml-1 text-[10px] text-muted-foreground/60">(opcional para PT)</span>
                  )}
                </label>
                <select
                  id="entry-supplier"
                  required={requiresSupplier}
                  value={form.supplier_id}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.company ?? s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notas */}
            <div className={`space-y-1.5 ${isCompra ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2 lg:col-span-2"}`}>
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

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Registrando..." : "Registrar Ingreso"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border bg-background px-6 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const LEDGER_DEFAULT = 5;
const LEDGER_STEP = 10;

const REF_TYPES = ["COMPRA", "AJUSTE", "DEVOLUCION", "PRODUCCION"] as const;

export function InventoryLedgerTable({ productId }: { productId?: string }) {
  const { entries, loading, error } = useInventoryLedger(productId);
  const [movType, setMovType] = useState("");
  const [refType, setRefType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visible, setVisible] = useState(LEDGER_DEFAULT);

  useEffect(() => { setVisible(LEDGER_DEFAULT); }, [movType, refType, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando movimientos...</span>
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

  const filtered = entries.filter((e) => {
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

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const hasActiveFilter = movType || refType || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Movimientos de Inventario</h3>
        {hasActiveFilter && (
          <button
            onClick={() => { setMovType(""); setRefType(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={movType}
          onChange={(e) => setMovType(e.target.value)}
          aria-label="Filtrar por tipo de movimiento"
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los tipos</option>
          <option value="INGRESO">Ingreso</option>
          <option value="EGRESO">Egreso</option>
        </select>

        <select
          value={refType}
          onChange={(e) => setRefType(e.target.value)}
          aria-label="Filtrar por origen"
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los orígenes</option>
          {REF_TYPES.map((r) => (
            <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <label htmlFor="ledger-from" className="text-xs text-muted-foreground">Desde</label>
          <input
            id="ledger-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="ledger-to" className="text-xs text-muted-foreground">Hasta</label>
          <input
            id="ledger-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table aria-label="Movimientos de inventario" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cantidad</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Costo Unit.</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Proveedor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Notas</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {hasActiveFilter ? "Sin resultados para los filtros aplicados" : "Sin movimientos registrados"}
                </td>
              </tr>
            ) : (
              shown.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.movement_type === "INGRESO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {entry.movement_type === "INGRESO" ? (
                          <span className="inline-flex items-center gap-1"><ArrowUp aria-hidden="true" className="h-3 w-3" /> Ingreso</span>
                        ) : (
                          <span className="inline-flex items-center gap-1"><ArrowDown aria-hidden="true" className="h-3 w-3" /> Egreso</span>
                        )}
                      </span>
                      {entry.reference_type && (
                        <span className="text-[10px] text-muted-foreground/70 px-0.5">{entry.reference_type}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {Number(entry.quantity).toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs hidden sm:table-cell">
                    {entry.unit_cost > 0 ? Number(entry.unit_cost).toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {entry.supplier_company ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        <HandshakeIcon aria-hidden="true" className="h-3 w-3 shrink-0" /> {entry.supplier_company}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate hidden lg:table-cell">
                    {entry.notes ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(hasMore || visible > LEDGER_DEFAULT) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Mostrando {shown.length} de {filtered.length}</span>
          <div className="flex gap-2">
            {hasMore && (
              <button
                onClick={() => setVisible((v) => v + LEDGER_STEP)}
                className="rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
              >
                Ver más
              </button>
            )}
            {visible > LEDGER_DEFAULT && (
              <button
                onClick={() => setVisible(LEDGER_DEFAULT)}
                className="rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
              >
                Contraer
              </button>
            )}
          </div>
        </div>
      )}
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
