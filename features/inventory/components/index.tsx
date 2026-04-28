"use client";

import { useStockSummary, useInventoryLedger, useInventoryActions, useRealtimeStock } from "@features/inventory/hooks";
import { formatDate } from "@shared/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Stock Actual</h3>
          {/* Indicador de conexión Realtime */}
          <span
            title={connected ? "Stock en vivo activo" : "Sin conexión realtime"}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
          >
            <span
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
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          ↻ Actualizar
        </button>
      </div>

      {pulse && (
        <div className="rounded-md bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 animate-pulse">
          ⚡ Movimiento detectado — stock actualizado
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                SKU
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Producto
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Tipo
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Stock
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
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
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-muted-foreground">
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
 * Permite al staff registrar entradas de materia prima o producto terminado.
 */
export function StockEntryForm({ onSuccess }: { onSuccess?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { registerMovement, loading, error } = useInventoryActions();
  const insforge = getInsforge();

  const [form, setForm] = useState({
    product_id: "",
    quantity: "",
    unit_cost: "",
    notes: "",
    reference_type: "COMPRA",
  });

  useEffect(() => {
    insforge.database
      .from("products")
      .select("id, name, sku, unit")
      .eq("is_active", true)
      .order("name")
      .then(
        ({ data }) => setProducts((data as Product[]) ?? []),
        () => {}
      );
  }, [insforge]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await registerMovement({
      product_id: form.product_id,
      quantity: Number(form.quantity),
      unit_cost: form.unit_cost ? Number(form.unit_cost) : 0,
      movement_type: "INGRESO",
      reference_type: form.reference_type,
      notes: form.notes || undefined,
    });

    if (!result.error) {
      setForm({ product_id: "", quantity: "", unit_cost: "", notes: "", reference_type: "COMPRA" });
      setShowForm(false);
      const product = products.find((p) => p.id === form.product_id);
      setSuccess(`✓ Ingreso registrado: ${form.quantity} ${product?.unit ?? ""} de ${product?.name ?? ""}`);
      setTimeout(() => setSuccess(null), 5000);
      onSuccess?.();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ingreso de Stock</h3>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setSuccess(null);
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancelar" : "📥 Nuevo Ingreso"}
        </button>
      </div>

      {success && (
        <div className="rounded-md bg-brand-50 border border-brand-200 px-4 py-3 text-sm font-medium text-brand-700">
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
                onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
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
                min="0.0001"
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
                onChange={(e) => setForm((p) => ({ ...p, reference_type: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="COMPRA">Compra a proveedor</option>
                <option value="AJUSTE">Ajuste de inventario</option>
                <option value="DEVOLUCION">Devolución</option>
                <option value="PRODUCCION">Producción</option>
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <label htmlFor="entry-notes" className="text-xs font-medium text-muted-foreground">
                Notas
              </label>
              <input
                id="entry-notes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Número de factura, proveedor, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
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
              className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Tabla del ledger de movimientos de inventario.
 */
export function InventoryLedgerTable({
  productId,
}: {
  productId?: string;
}) {
  const { entries, loading, error } = useInventoryLedger(productId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Movimientos de Inventario</h3>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Fecha
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Tipo
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Cantidad
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Costo Unit.
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Referencia
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Notas
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Sin movimientos registrados
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.movement_type === "INGRESO"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {entry.movement_type === "INGRESO" ? "↑ Ingreso" : "↓ Egreso"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {Number(entry.quantity).toLocaleString("es-EC", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                    {entry.unit_cost > 0
                      ? Number(entry.unit_cost).toLocaleString("es-EC", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {entry.reference_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {entry.notes ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors print:hidden flex items-center gap-2"
    >
      <span>📄</span> Exportar PDF
    </button>
  );
}
