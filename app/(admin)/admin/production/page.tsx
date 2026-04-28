"use client";

import { useProductionOrders, useRecipes } from "@features/production/hooks";
import { formatDate } from "@shared/lib/utils";
import { useState } from "react";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  BORRADOR: {
    label: "Borrador",
    className: "bg-gray-100 text-gray-700",
  },
  EN_PROCESO: {
    label: "En Proceso",
    className: "bg-blue-100 text-blue-700",
  },
  COMPLETADA: {
    label: "Completada",
    className: "bg-green-100 text-green-700",
  },
  CANCELADA: {
    label: "Cancelada",
    className: "bg-red-100 text-red-700",
  },
};

export default function AdminProductionPage() {
  const { orders, loading, completeOrder, updateStatus, createOrder, refetch } =
    useProductionOrders();
  const { recipes } = useRecipes();

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipe_id: "",
    target_yield: "",
    notes: "",
  });

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    const result = await createOrder({
      recipe_id: form.recipe_id,
      target_yield: Number(form.target_yield),
      notes: form.notes || undefined,
    });

    setCreating(false);
    if (result.error) {
      setFormError(result.error as string);
      return;
    }

    setForm({ recipe_id: "", target_yield: "", notes: "" });
    setShowForm(false);
    refetch();
  }

  const completedOrders = orders.filter((o) => o.status === "COMPLETADA");

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
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              <span>📄</span> PDF
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
          <form
            onSubmit={handleCreateOrder}
            className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4 print:hidden"
          >
            <h3 className="text-lg font-semibold">Nueva Orden de Producción</h3>
            <div className="grid gap-4 sm:grid-cols-3">
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
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (base: {r.yield_base} {r.yield_unit})
                    </option>
                  ))}
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
                  min="0.01"
                  step="0.01"
                  value={form.target_yield}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, target_yield: e.target.value }))
                  }
                  placeholder="Ej: 25"
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
        )}

        {/* Stats rápidas */}
        <div className="grid gap-3 sm:grid-cols-4 print:hidden">
          {[
            {
              label: "Total",
              value: orders.length,
              color: "bg-muted",
            },
            {
              label: "Borrador",
              value: orders.filter((o) => o.status === "BORRADOR").length,
              color: "bg-gray-100 text-gray-700",
            },
            {
              label: "En Proceso",
              value: orders.filter((o) => o.status === "EN_PROCESO").length,
              color: "bg-blue-100 text-blue-700",
            },
            {
              label: "Completadas",
              value: completedOrders.length,
              color: "bg-green-100 text-green-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-lg px-4 py-3 ${s.color}`}
            >
              <p className="text-xs font-medium opacity-70">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Receta
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Rendimiento
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground print:hidden">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
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
                  orders.map((order) => {
                    const status = STATUS_LABELS[order.status] ?? {
                      label: order.status,
                      className: "bg-gray-100 text-gray-700",
                    };
                    const recipe = recipes.find(
                      (r) => r.id === order.recipe_id
                    );
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {order.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {recipe?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {Number(order.target_yield).toLocaleString("es-EC")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 print:hidden">
                          {order.status === "BORRADOR" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateStatus(order.id, "EN_PROCESO")
                                }
                                className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 transition-colors"
                              >
                                Iniciar
                              </button>
                            </div>
                          )}
                          {order.status === "EN_PROCESO" && (
                            <button
                              onClick={() => completeOrder(order.id)}
                              className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                            >
                              Completar
                            </button>
                          )}
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
    </>
  );
}
