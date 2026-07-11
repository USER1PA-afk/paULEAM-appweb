"use client";

import {
  useProductionOrders,
  useProductionOrder,
  useRecipes,
  ProductionOrderDetail,
} from "@features/production";
import {
  usePackagingTemplates,
  usePackagingOrdersByProduction,
} from "@features/packaging";
import {
  PACKAGING_STATUS_LABELS,
  PACKAGING_STATUS_COLORS,
} from "@entities/packaging";
import { useRole } from "@features/auth/hooks";
import { formatDate } from "@shared/lib/utils";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Package, Trash2, FlaskConical, DollarSign, RotateCcw } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Sistema de unidades (igual al de production/page.tsx)
// ─────────────────────────────────────────────────────────────
const UNIT_GROUPS: Record<string, { label: string; factor: number }[]> = {
  MASA: [
    { label: "g",  factor: 1       },
    { label: "kg", factor: 1000    },
    { label: "lb", factor: 453.592 },
    { label: "oz", factor: 28.3495 },
  ],
  VOLUMEN: [
    { label: "ml",  factor: 1       },
    { label: "lt",  factor: 1000    },
    { label: "gal", factor: 3785.41 },
  ],
};

function getUnitGroup(unit: string): string | null {
  const u = unit.toLowerCase();
  if (["g", "kg", "lb", "lbs", "libra", "libras", "oz"].includes(u)) return "MASA";
  if (["ml", "lt", "gal"].includes(u)) return "VOLUMEN";
  return null;
}

function getUnitFactor(unit: string): number {
  const u = unit.toLowerCase();
  for (const group of Object.values(UNIT_GROUPS)) {
    const match = group.find((x) => x.label === u);
    if (match) return match.factor;
  }
  return 1;
}

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  BORRADOR:  { label: "Borrador",   dot: "bg-gray-400"   },
  EN_PROCESO:{ label: "En Proceso", dot: "bg-blue-500"   },
  COMPLETADA:{ label: "Completada", dot: "bg-accent-500" },
  CANCELADA: { label: "Cancelada",  dot: "bg-red-500"    },
};

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const { order, loading, error } = useProductionOrder(id);
  const { recipes } = useRecipes();
  const { templates: packagingTemplates } = usePackagingTemplates();
  const { orders: packagingOrders, refetch: refetchPackaging } = usePackagingOrdersByProduction(id);
  const { role } = useRole();
  const { declareWaste, reverseOrder } = useProductionOrders();
  const isAdmin = role === "admin";

  const [showWaste, setShowWaste] = useState(false);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [savingWaste, setSavingWaste] = useState(false);
  const [wasteError, setWasteError] = useState<string | null>(null);

  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const recipe = recipes.find((r) => r.id === order?.recipe_id);
  const status = order ? (STATUS_LABELS[order.status] ?? { label: order.status, dot: "bg-gray-400" }) : null;

  // Plantillas relevantes para esta receta (por producto de salida)
  const relevantTemplates = (order && recipe?.output_product_id)
    ? packagingTemplates.filter((t) => t.finished_product_id === recipe.output_product_id)
    : [];

  // IDs de plantillas que ya tienen órdenes vinculadas
  const usedTemplateIds = new Set(packagingOrders.map((po) => po.template_id));

  // Rendimiento en unidad legible
  const displayYield = (() => {
    if (!order || !recipe) return "—";
    const rUnit = recipe.yield_unit?.toLowerCase() || "";
    const rFactor = getUnitFactor(rUnit);
    const rGroup = getUnitGroup(rUnit);
    if (rGroup) {
      const preferred = rFactor < 100
        ? UNIT_GROUPS[rGroup]?.find((u) => u.factor >= 1000)
        : null;
      if (preferred) {
        const val = Number(order.target_yield) / (preferred.factor / rFactor);
        return `${val.toLocaleString("es-EC", { maximumFractionDigits: 3, useGrouping: false })} ${preferred.label}`;
      }
    }
    const isPhysical = ["kg", "lt"].includes(rUnit);
    return `${Number(order.target_yield).toLocaleString("es-EC", {
      minimumFractionDigits: isPhysical ? 2 : 0,
      maximumFractionDigits: 2,
      useGrouping: false,
    })} ${recipe.yield_unit ?? ""}`;
  })();

  // Unidades posibles por plantilla
  function possibleUnits(tpl: typeof packagingTemplates[0]): number {
    if (!order || !recipe) return 0;
    const bulkFactor = getUnitFactor(tpl.bulk_unit);
    const recFactor = getUnitFactor(recipe.yield_unit?.toLowerCase() || "");
    const yieldInBulk = Number(order.target_yield) * (recFactor / bulkFactor);
    return Math.floor(yieldInBulk / Number(tpl.bulk_qty_per_unit));
  }

  function handleCreatePackaging(templateId: string, units: number) {
    const p = new URLSearchParams({
      template_id: templateId,
      production_order_id: id,
      units: String(units),
    });
    router.push(`/admin/packaging?${p.toString()}`);
  }

  async function handleDeclareWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!wasteQty) return;
    setSavingWaste(true);
    setWasteError(null);
    const { error: wErr } = await declareWaste(id, Number(wasteQty), wasteNotes || undefined);
    setSavingWaste(false);
    if (wErr) { setWasteError(wErr); return; }
    setShowWaste(false);
    setWasteQty("");
    setWasteNotes("");
  }

  async function handleReverseOrder() {
    setReversing(true);
    setReverseError(null);
    const { error: rErr } = await reverseOrder(id);
    setReversing(false);
    if (rErr) { setReverseError(rErr); return; }
    setShowReverseConfirm(false);
    router.push("/admin/production");
  }

  // Costo total consolidado
  const productionCost = Number(order?.production_cost ?? 0);
  const packagingCostCompleted = packagingOrders
    .filter((po) => po.status === "COMPLETADA")
    .reduce((sum, po) => sum + Number(po.bulk_quantity_consumed ?? 0), 0);
  // bulk_quantity_consumed no tiene costo directo; el costo de empaque no está disponible
  // directamente en packaging_orders (solo en preview). Mostramos solo production_cost aquí.
  const totalCost = productionCost;

  // ─── Loading / Error ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error ?? "Orden no encontrada"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <button
            onClick={() => router.push("/admin/production")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Producción
          </button>
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {order.batch_number ?? order.id.substring(0, 8)}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {recipe && (
              <span className="text-sm text-muted-foreground">{recipe.name}</span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.dot}`} />
                <span className="text-xs font-medium text-foreground">{status.label}</span>
              </span>
            )}
          </div>
        </div>

        {isAdmin && order.status === "COMPLETADA" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowWaste(!showWaste)}
              className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 inline mr-1" />Declarar Merma
            </button>
            <button
              onClick={() => { setShowReverseConfirm(!showReverseConfirm); setShowWaste(false); }}
              className="rounded-md border border-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 inline mr-1" />Revertir Producción
            </button>
          </div>
        )}
      </div>

      {/* ── Formulario de merma ───────────────────────────────── */}
      {showWaste && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-900/10 p-4">
          <form onSubmit={handleDeclareWaste} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Cantidad de merma *</label>
              <input
                type="number" required min="0.001" step="0.001"
                value={wasteQty} onChange={(e) => setWasteQty(e.target.value)}
                placeholder="0.000"
                className="w-28 rounded-md border border-amber-300 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-40">
              <label className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Motivo (opcional)</label>
              <input
                type="text" value={wasteNotes} onChange={(e) => setWasteNotes(e.target.value)}
                placeholder="Daño de empaque, contaminación..."
                className="w-full rounded-md border border-amber-300 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              type="submit" disabled={savingWaste || !wasteQty}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {savingWaste ? "Registrando..." : "Registrar Merma"}
            </button>
            <button
              type="button"
              onClick={() => { setShowWaste(false); setWasteQty(""); setWasteNotes(""); setWasteError(null); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </form>
          {wasteError && (
            <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-xs text-destructive">{wasteError}</div>
          )}
        </div>
      )}

      {/* ── Confirmación de reversión ──────────────────────── */}
      {showReverseConfirm && (
        <div className="rounded-xl border border-red-300 bg-red-50/60 dark:bg-red-900/10 p-4">
          <p className="text-sm text-red-800 dark:text-red-300 mb-3">
            <strong>¿Revertir esta producción?</strong> Se eliminarán todos los movimientos de inventario de esta orden: la materia prima consumida se restaurará y el producto terminado se retirará. La orden volverá a estado Borrador para corrección.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReverseOrder}
              disabled={reversing}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {reversing ? "Revirtiendo..." : "Sí, revertir producción"}
            </button>
            <button
              type="button"
              onClick={() => { setShowReverseConfirm(false); setReverseError(null); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
          {reverseError && (
            <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-xs text-destructive">{reverseError}</div>
          )}
        </div>
      )}

      {/* ── Resumen del Lote ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-foreground">Resumen del Lote</h2>
        </div>
        <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Receta</p>
            <p className="font-medium text-foreground">{recipe?.name ?? "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Rendimiento Objetivo</p>
            <p className="font-semibold tabular-nums text-foreground">{displayYield}</p>
          </div>
          {productionCost > 0 && (
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Costo de Materiales</p>
              <p className="font-semibold tabular-nums text-foreground">
                {productionCost.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {order.scheduled_date && (
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fecha Planificada</p>
              <p className="text-foreground">{formatDate(order.scheduled_date)}</p>
            </div>
          )}
          {order.completed_at && (
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Completada</p>
              <p className="text-foreground">{formatDate(order.completed_at)}</p>
            </div>
          )}
          {order.notes && (
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Notas</p>
              <p className="text-foreground">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Movimientos de Inventario ─────────────────────────── */}
      {order.status === "COMPLETADA" && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">Movimientos de Inventario</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Consumo de materiales e ingreso de producto terminado</p>
          </div>
          <div className="p-5">
            <ProductionOrderDetail orderId={order.id} completedAt={order.completed_at ?? null} />
          </div>
        </div>
      )}

      {/* ── Empaque ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-foreground">Empaque</h2>
        </div>

        <div className="p-5 space-y-4">
          {order.status !== "COMPLETADA" ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4">
              <Package className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Producción no completada</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Completa la orden para gestionar el empaque del producto a granel.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Órdenes de empaque ya creadas */}
              {packagingOrders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Órdenes de Empaque Vinculadas</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                          <th className="px-3 py-2.5 text-center font-medium">Lote</th>
                          <th className="px-3 py-2.5 text-center font-medium">Presentación</th>
                          <th className="px-3 py-2.5 text-center font-medium">Unidades</th>
                          <th className="px-3 py-2.5 text-center font-medium">Estado</th>
                          <th className="px-3 py-2.5 text-center font-medium">Creada</th>
                          <th className="px-3 py-2.5 text-center font-medium">Ir a</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {packagingOrders.map((po) => {
                          const pkgStatus = po.status as keyof typeof PACKAGING_STATUS_LABELS;
                          const colorClass = PACKAGING_STATUS_COLORS[pkgStatus] ?? "bg-gray-400";
                          return (
                            <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-2.5 text-center font-mono text-xs text-muted-foreground">
                                {po.batch_number ?? po.id.substring(0, 8)}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs font-medium">
                                {po.template_name ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center tabular-nums font-semibold">
                                {po.units_to_package.toLocaleString("es-EC")}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="inline-flex items-center gap-1.5">
                                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
                                  <span className="text-xs">{PACKAGING_STATUS_LABELS[pkgStatus]}</span>
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">
                                {po.created_at ? formatDate(po.created_at) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => router.push("/admin/packaging")}
                                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  Ver →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Presentaciones disponibles para empacar */}
              {relevantTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {packagingOrders.length > 0 ? "Nuevas Presentaciones Disponibles" : "Presentaciones Disponibles"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {relevantTemplates.map((tpl) => {
                      const units = possibleUnits(tpl);
                      const alreadyCreated = usedTemplateIds.has(tpl.id);
                      return (
                        <div key={tpl.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold truncate">{tpl.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tpl.bulk_qty_per_unit} {tpl.bulk_unit} → 1 {tpl.output_unit}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold tabular-nums text-brand-600">
                              ~{units.toLocaleString("es-EC")} unidades
                            </span>
                            <button
                              onClick={() => handleCreatePackaging(tpl.id, units)}
                              disabled={units <= 0}
                              className="rounded-md bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                              {alreadyCreated ? "+ Otra orden" : "Crear Empaque →"}
                            </button>
                          </div>
                          {alreadyCreated && (
                            <p className="text-[10px] text-accent-600 dark:text-accent-400">
                              ✓ Ya existe una orden para esta presentación
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {relevantTemplates.length === 0 && packagingOrders.length === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4">
                  <Package className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sin plantillas de empaque</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      No hay plantillas configuradas para el producto de esta receta.{" "}
                      <button
                        onClick={() => router.push("/admin/packaging/templates/new")}
                        className="text-brand-600 hover:underline"
                      >
                        Crear plantilla →
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Resumen de Costos Consolidado ─────────────────────── */}
      {productionCost > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-accent-600" />
            <h2 className="text-sm font-semibold text-foreground">Resumen de Costos del Lote</h2>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Producción (materiales)</span>
              <span className="tabular-nums font-medium">
                {productionCost.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
              </span>
            </div>
            {packagingOrders.filter(po => po.status === "COMPLETADA").length > 0 && (
              <div className="flex items-center justify-between text-muted-foreground/70 text-xs">
                <span>Empaques completados</span>
                <span className="tabular-nums">{packagingOrders.filter(po => po.status === "COMPLETADA").length} orden(es)</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
              <span>Total costo de producción</span>
              <span className="tabular-nums text-foreground">
                {totalCost.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="h-4" />
    </div>
  );
}
