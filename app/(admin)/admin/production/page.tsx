"use client";

import {
  useProductionOrders,
  useRecipes,
  ProductionScalePreview,
} from "@features/production";
import { usePackagingTemplates } from "@features/packaging";
import { formatDate } from "@shared/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { useRole } from "@features/auth/hooks";
import { Printer, Trash2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
import { SearchableSelect } from "@shared/components/ui/searchable-select";

// ─────────────────────────────────────────────────────────────
// Sistema de unidades
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

export default function AdminProductionPage() {
  const {
    orders, loading,
    completeOrder, updateStatus, createOrder,
    cancelOrder, declareWaste, reverseOrder, refetch,
  } = useProductionOrders();
  const { recipes } = useRecipes();
  const { role } = useRole();

  const recipeOptions = useMemo(
    () =>
      recipes.map((r) => {
        const rUnit = r.yield_unit?.toLowerCase() || "";
        const rGroup = getUnitGroup(rUnit);
        const baseStr = rGroup
          ? (() => {
              const rFactor = getUnitFactor(rUnit);
              const displayOpt = UNIT_GROUPS[rGroup]?.find(
                (u) => u.factor >= rFactor && u.factor <= rFactor * 1000
              );
              const df = displayOpt?.factor ?? rFactor;
              const dl = displayOpt?.label ?? rUnit;
              const val = r.yield_base / (df / rFactor);
              return `${Number(val).toLocaleString("es-EC", { maximumFractionDigits: 3 })} ${dl}`;
            })()
          : `${r.yield_base} ${r.yield_unit}`;
        return {
          value: r.id,
          label: `${r.name} (base: ${baseStr})`,
        };
      }),
    [recipes]
  );
  const isAdmin = role === "admin";
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [displayUnit, setDisplayUnit] = useState<string>("");
  const [packagingSelections, setPackagingSelections] = useState<
    { templateId: string; units: string }[]
  >([]);

  // Merma
  const [wasteOrderId, setWasteOrderId] = useState<string | null>(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [savingWaste, setSavingWaste] = useState(false);

  // Reversión
  const [reverseOrderId, setReverseOrderId] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);

  const [form, setForm] = useState({
    recipe_id: "",
    target_yield: "",
    batch_number: "",
    scheduled_date: "",
    notes: "",
  });

  // ── Receta seleccionada ───────────────────────────────────
  const selectedRecipe = recipes.find((r) => r.id === form.recipe_id);
  const { templates: allPackagingTemplates } = usePackagingTemplates();
  const relevantTemplates = allPackagingTemplates.filter(
    (t) => t.finished_product_id === selectedRecipe?.output_product_id
  );
  const recipeUnit = selectedRecipe?.yield_unit?.toLowerCase() || "";
  const recipeUnitFactor = getUnitFactor(recipeUnit);
  const unitGroup = recipeUnit ? getUnitGroup(recipeUnit) : null;
  const unitGroupOptions = unitGroup ? UNIT_GROUPS[unitGroup] : [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (recipeUnit) setDisplayUnit(recipeUnit);
    else setDisplayUnit("");
    setPackagingSelections([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.recipe_id]);

  const activeDisplayUnit = displayUnit || recipeUnit;
  const displayFactor = getUnitFactor(activeDisplayUnit);

  const inputValue = Number(form.target_yield);
  const storedYield = inputValue > 0
    ? inputValue * (displayFactor / recipeUnitFactor)
    : 0;

  const targetYieldForPreview = storedYield;

  const isDiscrete = !unitGroup && ["unidad","unidades","unit","units"].includes(recipeUnit);
  const targetMin  = isDiscrete ? "1"     : "0.001";
  const targetStep = isDiscrete ? "1"     : "0.001";

  function handleUnitChange(newUnit: string) {
    const oldFactor = displayFactor;
    const newFactor = getUnitFactor(newUnit);
    if (inputValue > 0 && oldFactor !== newFactor) {
      const converted = inputValue * (oldFactor / newFactor);
      const rounded = parseFloat(converted.toPrecision(6));
      setForm((p) => ({ ...p, target_yield: String(rounded) }));
    }
    setDisplayUnit(newUnit);
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    const result = await createOrder({
      recipe_id: form.recipe_id,
      target_yield: storedYield,
      batch_number: form.batch_number || null,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes || null,
    });

    if (result.error) {
      setFormError(result.error as string);
      setCreating(false);
      return;
    }

    setForm({ recipe_id: "", target_yield: "", batch_number: "", scheduled_date: "", notes: "" });
    setDisplayUnit("");
    setShowForm(false);
    setCreating(false);
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
    if (wErr) setRowErrors((prev) => ({ ...prev, [wasteOrderId!]: wErr }));
    setWasteOrderId(null);
    setWasteQty("");
    setWasteNotes("");
  }

  async function handleReverseOrder(orderId: string) {
    setReversing(true);
    const { error: rErr } = await reverseOrder(orderId);
    setReversing(false);
    if (rErr) {
      setRowErrors((prev) => ({ ...prev, [orderId]: rErr }));
    }
    setReverseOrderId(null);
  }

  function togglePackagingSelection(templateId: string) {
    setPackagingSelections((prev) => {
      const exists = prev.find((s) => s.templateId === templateId);
      return exists
        ? prev.filter((s) => s.templateId !== templateId)
        : [...prev, { templateId, units: "" }];
    });
  }

  function setPackagingUnits(templateId: string, value: string) {
    setPackagingSelections((prev) =>
      prev.map((s) => s.templateId === templateId ? { ...s, units: value } : s)
    );
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
  const { page: prodPage, setPage: setProdPage, paged: pagedOrders, from: prodFrom, to: prodTo, total: prodTotal, totalPages: prodTotalPages } = usePagination(filteredOrders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setProdPage(1); }, [filterDate, filterStatus]);

  const showPreview = form.recipe_id !== "" && targetYieldForPreview > 0;

  return (
    <>
      {/* Print header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">PAuleam ERP — Reporte de Producción</h1>
        <p className="text-sm text-gray-500">
          Generado: {new Date().toLocaleString("es-EC")} — Total: {orders.length} | Completadas: {completedOrders.length}
        </p>
        <hr className="my-3" />
      </div>

      <div className="space-y-8 print:space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Producción</h1>
            <p className="mt-1 text-muted-foreground">
              Órdenes de producción con motor de escalado automático de recetas.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? "btn-outline" : "btn-primary"}
            >
              {showForm ? "Cancelar" : "+ Nueva Orden"}
            </button>
          </div>
        </div>

        {/* ── Formulario nueva orden ───────────────────────────── */}
        {showForm && (
          <div className="space-y-4 print:hidden">
            <form
              onSubmit={handleCreateOrder}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Header del formulario */}
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Nueva Orden de Producción</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El lote se auto-genera (PROD-YYYY-NNNN) si se deja vacío
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Sección 1: Receta y rendimiento */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Producción</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Receta */}
                    <div className="space-y-1.5">
                      <label htmlFor="prod-recipe" className="text-sm font-medium text-foreground">
                        Receta <span className="text-brand-500">*</span>
                      </label>
                      <SearchableSelect
                        id="prod-recipe"
                        required
                        options={recipeOptions}
                        value={form.recipe_id}
                        onChange={(val) => setForm((p) => ({ ...p, recipe_id: val, target_yield: "" }))}
                        placeholder="Seleccionar receta..."
                        searchPlaceholder="Buscar receta..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-brand-400"
                      />
                    </div>

                    {/* Rendimiento + toggle de unidades */}
                    <div className="space-y-1.5">
                      <label htmlFor="prod-yield" className="text-sm font-medium text-foreground">
                        Rendimiento Objetivo{activeDisplayUnit ? ` (${activeDisplayUnit})` : ""} <span className="text-brand-500">*</span>
                      </label>

                      <div className="space-y-2">
                        {unitGroupOptions.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {unitGroupOptions.map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => handleUnitChange(opt.label)}
                                className={`rounded-md px-3 py-1 text-xs font-semibold border transition-colors ${
                                  activeDisplayUnit === opt.label
                                    ? "bg-brand-600 text-white border-brand-600"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:border-brand-400"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}

                        <input
                          id="prod-yield"
                          type="number"
                          required
                          min={targetMin}
                          step={targetStep}
                          value={form.target_yield}
                          onChange={(e) => setForm((p) => ({ ...p, target_yield: e.target.value }))}
                          placeholder={`Ej: 2.5 ${activeDisplayUnit}`}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-brand-400"
                        />

                        {unitGroup && selectedRecipe && inputValue > 0 && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            = {storedYield.toLocaleString("es-EC", { maximumFractionDigits: 4 })} {recipeUnit}
                            <span className="mx-1.5 opacity-40">·</span>
                            Base: {selectedRecipe.yield_base} {recipeUnit}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divisor */}
                <div className="border-t border-border/60" />

                {/* Sección 2: Metadatos del lote */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detalles del Lote</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label htmlFor="prod-batch" className="text-sm font-medium text-foreground">
                        Nº Lote <span className="text-muted-foreground font-normal">(opcional)</span>
                      </label>
                      <input
                        id="prod-batch"
                        type="text"
                        value={form.batch_number}
                        onChange={(e) => setForm((p) => ({ ...p, batch_number: e.target.value }))}
                        placeholder="PROD-2026-0001"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-brand-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="prod-date" className="text-sm font-medium text-foreground">
                        Fecha Planificada
                      </label>
                      <input
                        id="prod-date"
                        type="date"
                        value={form.scheduled_date}
                        onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-brand-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="prod-notes" className="text-sm font-medium text-foreground">
                        Notas
                      </label>
                      <input
                        id="prod-notes"
                        type="text"
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Observaciones..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-brand-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Empaque planificado (opcional) */}
                {relevantTemplates.length > 0 && <div className="border-t border-border/60" />}
                {relevantTemplates.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Empaque Planificado
                      </p>
                      <span className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal">(opcional)</span>
                    </div>
                    <div className="space-y-2">
                      {relevantTemplates.map((template) => {
                        const sel = packagingSelections.find((s) => s.templateId === template.id);
                        const isChecked = !!sel;
                        return (
                          <div
                            key={template.id}
                            className={`rounded-lg border px-3 py-2.5 transition-colors ${
                              isChecked
                                ? "border-brand-400 bg-brand-50/40 dark:bg-brand-950/20"
                                : "border-border bg-background hover:border-brand-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`pkg-${template.id}`}
                                checked={isChecked}
                                onChange={() => togglePackagingSelection(template.id)}
                                className="h-4 w-4 rounded border-border accent-brand-600"
                              />
                              <label
                                htmlFor={`pkg-${template.id}`}
                                className="flex-1 text-sm font-medium text-foreground cursor-pointer select-none"
                              >
                                {template.name}
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                  {template.output_product_name}
                                </span>
                              </label>
                              {isChecked && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={sel!.units}
                                    onChange={(e) => setPackagingUnits(template.id, e.target.value)}
                                    placeholder="0"
                                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring tabular-nums transition-colors"
                                    aria-label={`Unidades a empacar de ${template.name}`}
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {template.output_unit}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Error */}
                {formError && (
                  <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                    <span aria-hidden="true" className="shrink-0 mt-0.5">✕</span>
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* Footer del formulario con CTA principal */}
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Creando...
                    </>
                  ) : "Crear Orden (Borrador)"}
                </button>
              </div>
            </form>

            {showPreview && (
              <ProductionScalePreview
                recipeId={form.recipe_id}
                targetYield={targetYieldForPreview}
                packagingSelections={packagingSelections
                  .filter((s) => s.units !== "" && Number(s.units) > 0)
                  .map((s) => ({ templateId: s.templateId, units: Number(s.units) }))}
              />
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-4 print:hidden">
          {[
            { label: "Total",       value: orders.length },
            { label: "Borrador",    value: orders.filter((o) => o.status === "BORRADOR").length },
            { label: "En Proceso",  value: orders.filter((o) => o.status === "EN_PROCESO").length },
            { label: "Completadas", value: completedOrders.length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{s.value}</p>
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

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Lote</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Receta</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Rendimiento</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No hay órdenes de producción
                    </td>
                  </tr>
                ) : (
                  pagedOrders.map((order) => {
                    const status = STATUS_LABELS[order.status] ?? { label: order.status, dot: "bg-gray-400" };
                    const recipe = recipes.find((r) => r.id === order.recipe_id);

                    // Mostrar rendimiento en unidad "grande" si aplica
                    const displayYield = (() => {
                      const rUnit = recipe?.yield_unit?.toLowerCase() || "";
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
                      const isPhysical = ["kg","lt"].includes(rUnit);
                      return `${Number(order.target_yield).toLocaleString("es-EC", {
                        minimumFractionDigits: isPhysical ? 2 : 0,
                        maximumFractionDigits: 2,
                        useGrouping: false,
                      })} ${recipe?.yield_unit ?? ""}`;
                    })();

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
                            {displayYield}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.dot}`} />
                              <span className="text-xs font-medium text-foreground">{status.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center print:hidden">
                            {order.status === "BORRADOR" && (
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => updateStatus(order.id, "EN_PROCESO")}
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
                                {rowErrors[order.id] && (
                                  <div className="max-w-xs rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-[10px] text-destructive leading-tight">
                                    {rowErrors[order.id]}
                                  </div>
                                )}
                              </div>
                            )}
                            {order.status === "COMPLETADA" && (
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <button
                                  onClick={() => router.push(`/admin/production/${order.id}`)}
                                  className="rounded-md bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                                >
                                  Ver Detalle
                                </button>
                                {isAdmin && (
                                  <>
                                    <button
                                      onClick={() => setWasteOrderId(wasteOrderId === order.id ? null : order.id)}
                                      className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3 inline mr-0.5" />Merma
                                    </button>
                                    <button
                                      onClick={() => setReverseOrderId(reverseOrderId === order.id ? null : order.id)}
                                      className="rounded-md border border-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    >
                                      <RotateCcw className="h-3 w-3 inline mr-0.5" />Revertir
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Merma */}
                        {wasteOrderId === order.id && order.status === "COMPLETADA" && (
                          <tr className="bg-amber-50/60 dark:bg-amber-900/10 border-t-0">
                            <td colSpan={6} className="px-4 py-3 pb-4">
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
                                <div className="space-y-1 flex-1 min-w-32">
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

                        {/* Confirmación de reversión */}
                        {reverseOrderId === order.id && order.status === "COMPLETADA" && (
                          <tr className="bg-red-50/60 dark:bg-red-900/10 border-t-0">
                            <td colSpan={6} className="px-4 py-3 pb-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-xs text-red-800 dark:text-red-300 flex-1 min-w-48">
                                  <strong>¿Revertir esta producción?</strong> Se eliminarán todos los movimientos de inventario (materia prima se restaura, producto terminado se retira) y la orden volverá a Borrador.
                                </p>
                                <button
                                  onClick={() => handleReverseOrder(order.id)}
                                  disabled={reversing}
                                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {reversing ? "Revirtiendo..." : "Sí, revertir"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReverseOrderId(null)}
                                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
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
        <TablePagination
          page={prodPage}
          totalPages={prodTotalPages}
          from={prodFrom}
          to={prodTo}
          total={prodTotal}
          onPageChange={setProdPage}
        />
      </div>
    </>
  );
}
