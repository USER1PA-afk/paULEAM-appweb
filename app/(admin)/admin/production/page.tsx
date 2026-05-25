"use client";

import { useProductionOrders, useRecipes, ProductionScalePreview, ProductionOrderDetail } from "@features/production";
import { formatDate } from "@shared/lib/utils";
import React, { useState } from "react";
import { useRole } from "@features/auth/hooks";
import { Printer, Trash2 } from "lucide-react";


const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  BORRADOR: { label: "Borrador", dot: "bg-gray-400" },
  EN_PROCESO: { label: "En Proceso", dot: "bg-blue-500" },
  COMPLETADA: { label: "Completada", dot: "bg-accent-500" },
  CANCELADA: { label: "Cancelada", dot: "bg-red-500" },
};

export default function AdminProductionPage() {
  const { orders, loading, completeOrder, updateStatus, createOrder, cancelOrder, declareWaste, refetch } =
    useProductionOrders();
  const { recipes } = useRecipes();
  const { role } = useRole();
  const isAdmin = role === "admin";

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Merma
  const [wasteOrderId, setWasteOrderId] = useState<string | null>(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [savingWaste, setSavingWaste] = useState(false);

  const [form, setForm] = useState({
    recipe_id: "",
    target_yield: "",
    batch_number: "",
    scheduled_date: "",
    notes: "",
  });

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    const result = await createOrder({
      recipe_id: form.recipe_id,
      target_yield: Number(form.target_yield),
      batch_number: form.batch_number || null,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes || null,
    });

    setCreating(false);
    if (result.error) {
      setFormError(result.error as string);
      return;
    }

    setForm({ recipe_id: "", target_yield: "", batch_number: "", scheduled_date: "", notes: "" });
    setShowForm(false);
    refetch();
  }

  function setRowError(orderId: string, msg: string | null) {
    setRowErrors((prev) => {
      if (msg === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [orderId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [orderId]: msg };
    });
  }

  async function handleComplete(orderId: string) {
    setRowError(orderId, null);
    const result = await completeOrder(orderId);
    if (result.error) setRowError(orderId, result.error as string);
  }

  async function handleCancel(orderId: string) {
    if (!confirm("¿Cancelar esta orden de producción? Esta acción no se puede deshacer.")) return;
    setRowError(orderId, null);
    const result = await cancelOrder(orderId);
    if (result.error) setRowError(orderId, result.error as string);
  }

  async function handleDeclareWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!wasteOrderId || !wasteQty) return;
    setSavingWaste(true);
    const { error: wErr } = await declareWaste(wasteOrderId, Number(wasteQty), wasteNotes || undefined);
    setSavingWaste(false);
    if (wErr) {
      setRowErrors((prev) => ({ ...prev, [wasteOrderId]: wErr }));
    }
    setWasteOrderId(null);
    setWasteQty("");
    setWasteNotes("");
  }

  const completedOrders = orders.filter((o) => o.status === "COMPLETADA");

  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterDate) {
      const orderDate = o.created_at ? o.created_at.substring(0, 10) : "";
      if (orderDate !== filterDate) return false;
    }
    return true;
  });

  // Validamos si hay suficientes datos para el preview
  const showPreview = form.recipe_id !== "" && Number(form.target_yield) > 0;

  const selectedRecipe = recipes.find((r) => r.id === form.recipe_id);
  const selectedRecipeUnit = selectedRecipe?.yield_unit?.toLowerCase() || "";
  let targetMin = "0.01";
  let targetStep = "0.01";
  if (["unidad", "unidades", "libra", "libras", "unit", "units", "lb", "lbs"].includes(selectedRecipeUnit)) {
    targetMin = "1";
    targetStep = "1";
  }

  return (
    <>
      {/* Print header — solo visible al imprimir */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">PAuleam ERP — Reporte de Producción</h1>
        <p className="text-sm text-gray-500">
          Generado: {new Date().toLocaleString("es-EC")} — Total órdenes:{" "}
          {orders.length} | Completadas: {completedOrders.length}
        </p>
        <hr className="my-3" />
      </div>

      <div className="space-y-8 print:space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Producción</h1>
            <p className="mt-1 text-muted-foreground">
              Órdenes de producción con motor de escalado automático de recetas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              {showForm ? "Cancelar" : "+ Nueva Orden"}
            </button>
          </div>
        </div>

        {/* Formulario nueva orden */}
        {showForm && (
          <div className="space-y-4 print:hidden">
            <form
              onSubmit={handleCreateOrder}
              className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
            >
              <h3 className="text-lg font-semibold">Nueva Orden de Producción</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-3">
                  <p className="text-[10px] text-muted-foreground">
                    El número de lote se auto-genera (PROD-YYYY-NNNN) si se deja vacío.
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <label htmlFor="prod-recipe" className="text-xs font-medium text-muted-foreground">
                    Receta *
                  </label>
                  <select
                    id="prod-recipe"
                    required
                    value={form.recipe_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, recipe_id: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Seleccionar receta...</option>
                    {recipes.map((r) => {
                      const isPhysical = ["kg", "lt"].includes(r.yield_unit?.toLowerCase() || "");
                      const formattedYield = Number(r.yield_base).toLocaleString("es-EC", {
                        minimumFractionDigits: isPhysical ? 2 : 0,
                        maximumFractionDigits: 2,
                        useGrouping: false,
                      });
                      return (
                        <option key={r.id} value={r.id}>
                          {r.name} (base: {formattedYield} {r.yield_unit})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prod-yield" className="text-xs font-medium text-muted-foreground">
                    Rendimiento Objetivo *
                  </label>
                  <input
                    id="prod-yield"
                    type="number"
                    required
                    min={targetMin}
                    step={targetStep}
                    value={form.target_yield}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, target_yield: e.target.value }))
                    }
                    placeholder="Ej: 25"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prod-batch" className="text-xs font-medium text-muted-foreground">
                    Nº Lote (opcional)
                  </label>
                  <input
                    id="prod-batch"
                    type="text"
                    value={form.batch_number}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, batch_number: e.target.value }))
                    }
                    placeholder="PROD-2026-0001"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prod-date" className="text-xs font-medium text-muted-foreground">
                    Fecha Planificada
                  </label>
                  <input
                    id="prod-date"
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, scheduled_date: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prod-notes" className="text-xs font-medium text-muted-foreground">
                    Notas
                  </label>
                  <input
                    id="prod-notes"
                    type="text"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    placeholder="Observaciones..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creando..." : "Crear Orden (Borrador)"}
              </button>
            </form>

            {showPreview && (
              <ProductionScalePreview
                recipeId={form.recipe_id}
                targetYield={Number(form.target_yield)}
              />
            )}
          </div>
        )}

        {/* Stats rápidas */}
        <div className="grid gap-3 sm:grid-cols-4 print:hidden">
          {[
            {
              label: "Total",
              value: orders.length,
            },
            {
              label: "Borrador",
              value: orders.filter((o) => o.status === "BORRADOR").length,
            },
            {
              label: "En Proceso",
              value: orders.filter((o) => o.status === "EN_PROCESO").length,
            },
            {
              label: "Completadas",
              value: completedOrders.length,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-date" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Fecha</label>
            <input
              id="filter-date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Estado</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {(filterDate || filterStatus) && (
            <button
              onClick={() => { setFilterDate(""); setFilterStatus(""); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla de órdenes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Lote
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Receta
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Rendimiento
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground print:hidden">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No hay órdenes de producción
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const status = STATUS_LABELS[order.status] ?? {
                      label: order.status,
                      dot: "bg-gray-400",
                    };
                    const recipe = recipes.find(
                      (r) => r.id === order.recipe_id
                    );
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <React.Fragment key={order.id}>
                        <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                            {order.batch_number ?? order.id.substring(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                            {order.created_at ? formatDate(order.created_at) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium">
                            {recipe?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums">
                            {(() => {
                              const isPhysical = ["kg", "lt"].includes(recipe?.yield_unit?.toLowerCase() || "");
                              return Number(order.target_yield).toLocaleString("es-EC", {
                                minimumFractionDigits: isPhysical ? 2 : 0,
                                maximumFractionDigits: 2,
                                useGrouping: false,
                              });
                            })()} {recipe?.yield_unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.dot}`} />
                              <span className="text-xs font-medium text-foreground">{status.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center print:hidden">
                            {/* Actions for BORRADOR */}
                            {order.status === "BORRADOR" && (
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() =>
                                    updateStatus(order.id, "EN_PROCESO")
                                  }
                                  className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 transition-colors"
                                >
                                  Iniciar
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleCancel(order.id)}
                                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Actions for EN_PROCESO */}
                            {order.status === "EN_PROCESO" && (
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={() => handleComplete(order.id)}
                                    className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                                  >
                                    Completar
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleCancel(order.id)}
                                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                </div>
                                {/* Inline error from trigger (e.g. stock insuficiente) */}
                                {rowErrors[order.id] && (
                                  <div className="max-w-xs rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-[10px] text-destructive leading-tight">
                                    {rowErrors[order.id]}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Actions for COMPLETADA */}
                            {order.status === "COMPLETADA" && (
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <button
                                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                  className="rounded-md bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                                >
                                  {isExpanded ? "Ocultar" : "Ver Detalle"}
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => setWasteOrderId(wasteOrderId === order.id ? null : order.id)}
                                    className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3 inline mr-0.5" />Merma
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && order.status === "COMPLETADA" && (
                          <tr className="bg-muted/10 border-t-0">
                            <td colSpan={6} className="px-4 py-3 pb-4">
                              <ProductionOrderDetail orderId={order.id} completedAt={order.completed_at ?? null} />
                            </td>
                          </tr>
                        )}
                        {wasteOrderId === order.id && order.status === "COMPLETADA" && (
                          <tr className="bg-amber-50/60 dark:bg-amber-900/10 border-t-0">
                            <td colSpan={6} className="px-4 py-3 pb-4">
                              <form onSubmit={handleDeclareWaste} className="flex flex-wrap items-end gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Cantidad de merma *</label>
                                  <input
                                    type="number"
                                    required
                                    min="0.001"
                                    step="0.001"
                                    value={wasteQty}
                                    onChange={(e) => setWasteQty(e.target.value)}
                                    placeholder="0.000"
                                    className="w-28 rounded-md border border-amber-300 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  />
                                </div>
                                <div className="space-y-1 flex-1 min-w-32">
                                  <label className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Motivo (opcional)</label>
                                  <input
                                    type="text"
                                    value={wasteNotes}
                                    onChange={(e) => setWasteNotes(e.target.value)}
                                    placeholder="Daño de empaque, contaminación..."
                                    className="w-full rounded-md border border-amber-300 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  />
                                </div>
                                <button
                                  type="submit"
                                  disabled={savingWaste || !wasteQty}
                                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                                >
                                  {savingWaste ? "Registrando..." : "Registrar Merma"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setWasteOrderId(null); setWasteQty(""); setWasteNotes(""); }}
                                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  Cancelar
                                </button>
                              </form>
                              {rowErrors[order.id] && (
                                <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-xs text-destructive">
                                  {rowErrors[order.id]}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
