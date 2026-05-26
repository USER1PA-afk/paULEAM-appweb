"use client";

import { usePackagingOrders, usePackagingTemplates, usePackagingActions } from "@features/packaging";
import { useRole } from "@features/auth/hooks";
import { formatDate } from "@shared/lib/utils";
import Link from "next/link";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  PACKAGING_STATUS_LABELS,
  PACKAGING_STATUS_COLORS,
} from "@entities/packaging";

// ─────────────────────────────────────────────────────────────
// Inner component que usa useSearchParams (requiere Suspense)
// ─────────────────────────────────────────────────────────────
function AdminPackagingPageInner() {
  const { orders, loading, error, refetch } = usePackagingOrders();
  const { templates } = usePackagingTemplates();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const searchParams = useSearchParams();

  const { completeOrder, cancelOrder, updateStatus, createOrder } = usePackagingActions(refetch);

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState("");

  const [form, setForm] = useState({
    template_id: "",
    units_to_package: "",
    production_order_id: "",
    notes: "",
  });

  // Pre-rellenar formulario desde parámetros de URL (viene de producción)
  useEffect(() => {
    const tplId = searchParams.get("template_id");
    const prodId = searchParams.get("production_order_id");
    const units = searchParams.get("units");
    if (tplId) {
      setForm((p) => ({
        ...p,
        template_id: tplId,
        production_order_id: prodId ?? "",
        units_to_package: units ?? "",
      }));
      setShowForm(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRowError(id: string, msg: string | null) {
    setRowErrors((prev) => {
      if (msg === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: msg };
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    const result = await createOrder({
      template_id: form.template_id,
      units_to_package: Number(form.units_to_package),
      production_order_id: form.production_order_id || null,
      notes: form.notes || null,
    });

    setCreating(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setForm({ template_id: "", units_to_package: "", production_order_id: "", notes: "" });
    setShowForm(false);
  }

  async function handleComplete(id: string) {
    setRowError(id, null);
    const { error: err } = await completeOrder(id);
    if (err) setRowError(id, err);
  }

  async function handleCancel(id: string) {
    if (!confirm("¿Cancelar esta orden de empaque?")) return;
    setRowError(id, null);
    const { error: err } = await cancelOrder(id);
    if (err) setRowError(id, err);
  }

  const filteredOrders = orders.filter((o) =>
    !filterStatus || o.status === filterStatus
  );

  const completedCount = orders.filter((o) => o.status === "COMPLETADA").length;
  const inProgressCount = orders.filter((o) => o.status === "EN_PROCESO").length;

  // Plantilla seleccionada (para mostrar info de conversión)
  const selectedTemplate = templates.find((t) => t.id === form.template_id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empaque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversión de producto a granel en presentaciones empacadas.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Link
              href="/admin/packaging/templates"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Plantillas
            </Link>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nueva Orden"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total", value: orders.length },
          { label: "En Proceso", value: inProgressCount },
          { label: "Completadas", value: completedCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Formulario nueva orden */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <h3 className="text-lg font-semibold">Nueva Orden de Empaque</h3>

          {/* Badge de vinculación con producción */}
          {form.production_order_id && (
            <div className="inline-flex items-center gap-2 rounded-md bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Vinculado a orden de producción:{" "}
              <span className="font-mono">{form.production_order_id.substring(0, 8)}</span>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, production_order_id: "" }))}
                className="ml-1 text-brand-400 hover:text-brand-700 transition-colors"
                title="Desvincular"
              >
                ×
              </button>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              No hay plantillas de empaque activas.{" "}
              {isAdmin && (
                <Link href="/admin/packaging/templates/new" className="font-semibold underline">
                  Crear una plantilla
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Plantilla */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Plantilla *</label>
                <select
                  required
                  value={form.template_id}
                  onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Seleccionar plantilla...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.finished_product_name ?? "?"} → {t.output_product_name ?? "?"}
                    </option>
                  ))}
                </select>
                {/* Info de conversión de la plantilla seleccionada */}
                {selectedTemplate && (
                  <p className="text-[10px] text-muted-foreground">
                    Consume {selectedTemplate.bulk_qty_per_unit} {selectedTemplate.bulk_unit} de granel por unidad empacada ({selectedTemplate.output_unit})
                  </p>
                )}
              </div>

              {/* Unidades */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Unidades a empacar *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.units_to_package}
                  onChange={(e) => setForm((p) => ({ ...p, units_to_package: e.target.value }))}
                  placeholder="Ej: 50"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {/* Calculo de consumo estimado */}
                {selectedTemplate && Number(form.units_to_package) > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Consumirá ≈{" "}
                    <span className="font-semibold">
                      {(Number(form.units_to_package) * Number(selectedTemplate.bulk_qty_per_unit)).toLocaleString("es-EC", { maximumFractionDigits: 4 })} {selectedTemplate.bulk_unit}
                    </span>{" "}
                    de granel
                  </p>
                )}
              </div>

              {/* Notas */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Notas</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Observaciones..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          {templates.length > 0 && (
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creando..." : "Crear Orden (Borrador)"}
            </button>
          )}
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {Object.entries(PACKAGING_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus("")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Plantilla</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Unidades</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Lote</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No hay órdenes de empaque
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusLabel = PACKAGING_STATUS_LABELS[order.status] ?? order.status;
                  const statusDot = PACKAGING_STATUS_COLORS[order.status] ?? "bg-gray-400";

                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                        {order.id.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                        {order.created_at ? formatDate(order.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-medium">{order.template_name ?? "—"}</div>
                        {order.finished_product_name && order.output_product_name && (
                          <div className="text-[10px] text-muted-foreground">
                            {order.finished_product_name} → {order.output_product_name}
                          </div>
                        )}
                        {order.production_order_id && (
                          <div className="text-[10px] text-brand-600 dark:text-brand-400 font-mono mt-0.5">
                            Prod: {order.production_order_id.substring(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums">
                        {Number(order.units_to_package).toLocaleString("es-EC")}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground hidden md:table-cell">
                        {order.batch_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
                          <span className="text-xs font-medium">{statusLabel}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex justify-center gap-2">
                            {order.status === "BORRADOR" && (
                              <>
                                <button
                                  onClick={() => updateStatus(order.id, "EN_PROCESO")}
                                  className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 transition-colors"
                                >
                                  Iniciar
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleCancel(order.id)}
                                    className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </>
                            )}
                            {order.status === "EN_PROCESO" && (
                              <>
                                <button
                                  onClick={() => handleComplete(order.id)}
                                  className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                                >
                                  Completar
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleCancel(order.id)}
                                    className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </>
                            )}
                            {order.status === "COMPLETADA" && (
                              <span className="text-xs text-muted-foreground">
                                {order.completed_at ? formatDate(order.completed_at) : "Completada"}
                              </span>
                            )}
                          </div>
                          {rowErrors[order.id] && (
                            <div className="max-w-xs rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-[10px] text-destructive leading-tight">
                              {rowErrors[order.id]}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Export default con Suspense (requerido por useSearchParams)
// ─────────────────────────────────────────────────────────────
export default function AdminPackagingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    }>
      <AdminPackagingPageInner />
    </Suspense>
  );
}
