"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRole } from "@features/auth/hooks";
import { formatDate } from "@shared/lib/utils";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
import { SearchableSelect } from "@shared/components/ui/searchable-select";
import { getInsforge } from "@shared/lib/insforge/client";
import {
  useUnifiedOrders,
  useUnifiedIngredients,
  useFinishedProducts,
} from "@features/production/hooks/use-unified-production";
import { useRecipes } from "@features/production/hooks";
import {
  UnifiedProductionOrder,
  DraftPresentation,
} from "@entities/production/unified";
import { PackageCheck, ChevronRight, Trash2, AlertCircle, CheckCircle2, Scale, FlaskConical, Printer } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; ring: string }> = {
  BORRADOR:   { label: "Borrador",   dot: "bg-gray-400",     ring: "ring-gray-200"     },
  EN_PROCESO: { label: "En Proceso", dot: "bg-blue-500",     ring: "ring-blue-200"     },
  COMPLETADA: { label: "Completada", dot: "bg-emerald-500",  ring: "ring-emerald-200"  },
  CANCELADA:  { label: "Cancelada",  dot: "bg-red-500",      ring: "ring-red-200"      },
};

function pct(n: number) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function kg(n: number, decimals = 3) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function generateClientId() {
  return Math.random().toString(36).substring(2);
}

// ─────────────────────────────────────────────────────────────
// Sub-component: MassBar
// ─────────────────────────────────────────────────────────────

function MassBar({ assigned, total }: { assigned: number; total: number }) {
  if (total <= 0) return null;
  const ratio = Math.min(assigned / total, 1);
  const percent = ratio * 100;
  const diff = assigned - total;
  const isOver  = diff > 0.5;
  const isOk    = Math.abs(diff) <= 0.5;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">Balance de masa</span>
        <span className={`tabular-nums font-semibold ${isOver ? "text-red-500" : isOk ? "text-emerald-500" : "text-muted-foreground"}`}>
          {kg(assigned)} / {kg(total)} kg
          {isOk && " ✓"}
          {isOver && ` (+${kg(diff)} exceso)`}
          {!isOk && !isOver && ` (${kg(Math.abs(diff))} restante)`}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOver ? "bg-red-500" : isOk ? "bg-emerald-500" : "bg-brand-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: PresentationRow
// ─────────────────────────────────────────────────────────────

interface PresentationRowProps {
  draft:     DraftPresentation;
  onChange:  (clientId: string, units: string) => void;
  onRemove:  (clientId: string) => void;
}

function PresentationRow({ draft, onChange, onRemove }: PresentationRowProps) {
  const units = Number(draft.units_to_produce) || 0;
  const totalKg = units * draft.capacity_kg;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{draft.product_name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{draft.product_sku} · {kg(draft.capacity_kg)} kg/unidad</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={draft.units_to_produce}
          onChange={(e) => onChange(draft.clientId, e.target.value)}
          className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`Unidades de ${draft.product_name}`}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{draft.sales_unit_name}</span>
      </div>

      <div className="text-right shrink-0 min-w-[64px]">
        <p className="text-sm font-semibold tabular-nums">{kg(totalKg)}</p>
        <p className="text-[10px] text-muted-foreground">kg</p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(draft.clientId)}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label={`Eliminar ${draft.product_name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function AdminProductionPage() {
  const { role } = useRole();
  const isAdmin = role === "admin";

  // ── Data hooks ──────────────────────────────────────────────
  const insforge = getInsforge();
  const { orders, loading: ordersLoading, createOrder, updateWaste, executeOrder, cancelOrder, refetch } = useUnifiedOrders();
  const { recipes, loading: recipesLoading } = useRecipes();
  const { products: finishedProducts, loading: productsLoading } = useFinishedProducts();

  // ── Form state ───────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Block A
  const [recipeId, setRecipeId] = useState("");
  const [batchKgInput, setBatchKgInput] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");

  // Block B — presentaciones (borrador en memoria)
  const [drafts, setDrafts] = useState<DraftPresentation[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  // Block C — merma y cierre
  const [wasteKgInput, setWasteKgInput] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Historial
  const [filterStatus, setFilterStatus] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────
  const batchKg = Number(batchKgInput) || 0;

  const {
    recipe: selectedRecipe,
    ingredientRows,
    percentageSum,
    allStockSufficient: ingredientStockOk,
    hasPercentages,
    loading: ingLoading,
  } = useUnifiedIngredients(recipeId || null, batchKg);

  const recipeOptions = useMemo(
    () => recipes.map((r) => ({ value: r.id, label: `${r.name} (base: ${r.yield_base} ${r.yield_unit})` })),
    [recipes]
  );

  const finishedOptions = useMemo(
    () =>
      finishedProducts
        .filter((p) => !drafts.some((d) => d.product_id === p.id))
        .map((p) => ({
          value: p.id,
          label: `${p.name} — ${p.sales_unit_name} (${kg(p.capacity_kg)} kg/u)`,
        })),
    [finishedProducts, drafts]
  );

  const totalAssignedKg = useMemo(
    () => drafts.reduce((sum, d) => sum + (Number(d.units_to_produce) || 0) * d.capacity_kg, 0),
    [drafts]
  );

  const massOk = batchKg > 0 && Math.abs(totalAssignedKg - batchKg) <= 0.5;
  const percentOk = hasPercentages && percentageSum > 0;
  const canComplete = massOk && percentOk && ingredientStockOk && drafts.length > 0;

  // ── Reset when recipe changes ────────────────────────────────
  useEffect(() => {
    setDrafts([]);
    setSelectedProductId("");
  }, [recipeId]);

  // ── Handlers: Block B ─────────────────────────────────────────

  function handleAddPresentation() {
    if (!selectedProductId) return;
    const p = finishedProducts.find((x) => x.id === selectedProductId);
    if (!p) return;

    setDrafts((prev) => [
      ...prev,
      {
        clientId:        generateClientId(),
        product_id:      p.id,
        product_name:    p.name,
        product_sku:     p.sku,
        units_to_produce: "",
        capacity_kg:     p.capacity_kg,
        sales_unit_name: p.sales_unit_name,
        total_kg:        0,
        stock_available: 0,
        packaging_ok:    null,
      },
    ]);
    setSelectedProductId("");
  }

  function handleDraftChange(clientId: string, units: string) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.clientId === clientId
          ? { ...d, units_to_produce: units, total_kg: (Number(units) || 0) * d.capacity_kg }
          : d
      )
    );
  }

  function handleDraftRemove(clientId: string) {
    setDrafts((prev) => prev.filter((d) => d.clientId !== clientId));
  }

  // ── Handlers: Submit ──────────────────────────────────────────

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    // 1. Create order
    const { data: order, error: createErr } = await createOrder({
      recipe_id:      recipeId,
      batch_kg:       batchKg,
      waste_kg:       Number(wasteKgInput) || 0,
      scheduled_date: scheduledDate || null,
      notes:          notes || null,
    });

    if (createErr || !order) {
      setFormError(createErr ?? "Error al crear la orden");
      setSubmitting(false);
      return;
    }

    // 2. Insert presentations
    const presentationRows = drafts.map((d) => ({
      order_id:         order.id,
      product_id:       d.product_id,
      units_to_produce: Number(d.units_to_produce) || 0,
      capacity_kg:      d.capacity_kg,
      total_kg:         (Number(d.units_to_produce) || 0) * d.capacity_kg,
    }));

    const { error: presErr } = await insforge.database
      .from("unified_production_presentations")
      .insert(presentationRows);

    if (presErr) {
      setFormError((presErr as { message?: string })?.message ?? "Error al guardar presentaciones");
      setSubmitting(false);
      return;
    }

    // 3. Execute RPC
    const { error: execErr } = await executeOrder(order.id);
    if (execErr) {
      setFormError(execErr);
      setSubmitting(false);
      return;
    }

    // 4. Reset form
    setRecipeId("");
    setBatchKgInput("");
    setDrafts([]);
    setWasteKgInput("0");
    setScheduledDate("");
    setNotes("");
    setStep(1);
    setShowForm(false);
    setSubmitting(false);
    refetch();
  }

  // ── Historial handlers ────────────────────────────────────────

  const setRowError = useCallback((id: string, msg: string | null) => {
    setRowErrors((prev) => {
      if (msg === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: msg };
    });
  }, []);

  async function handleExecuteExisting(orderId: string) {
    setExecuting(orderId);
    setRowError(orderId, null);
    const { error: execErr } = await executeOrder(orderId);
    if (execErr) setRowError(orderId, execErr);
    setExecuting(null);
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm("¿Cancelar esta orden? Esta acción no se puede deshacer.")) return;
    setRowError(orderId, null);
    const { error } = await cancelOrder(orderId);
    if (error) setRowError(orderId, error);
  }

  // ── Pagination ────────────────────────────────────────────────
  const filteredOrders = useMemo(
    () => orders.filter((o) => !filterStatus || o.status === filterStatus),
    [orders, filterStatus]
  );
  const {
    page, setPage, paged, from, to, total: totalPages2, totalPages,
  } = usePagination(filteredOrders);

  const completedCount  = orders.filter((o) => o.status === "COMPLETADA").length;
  const borradorCount   = orders.filter((o) => o.status === "BORRADOR").length;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">PAuleam ERP — Producción Unificada</h1>
        <p className="text-sm text-gray-500">
          Generado: {new Date().toLocaleString("es-EC")} — Total: {orders.length} | Completadas: {completedCount}
        </p>
        <hr className="my-3" />
      </div>

      <div className="space-y-8 print:space-y-4">
        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-brand-500" />
              Producción
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lotes unificados: receta → materia prima → presentaciones empacadas en un solo paso.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setStep(1); }}
              className={showForm ? "btn-outline" : "btn-primary"}
            >
              {showForm ? "Cancelar" : "+ Nuevo Lote"}
            </button>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-4 print:hidden">
          {[
            { label: "Total",       value: orders.length },
            { label: "Borrador",    value: borradorCount  },
            { label: "En Proceso",  value: orders.filter((o) => o.status === "EN_PROCESO").length },
            { label: "Completados", value: completedCount  },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Formulario nuevo lote ─────────────────────────── */}
        {showForm && (
          <form onSubmit={handleSubmitOrder} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden print:hidden">

            {/* Step tabs */}
            <div className="flex border-b border-border bg-muted/30">
              {([
                { n: 1 as const, label: "A · Lote e ingredientes", icon: Scale },
                { n: 2 as const, label: "B · Presentaciones",       icon: PackageCheck },
                { n: 3 as const, label: "C · Merma y cierre",       icon: CheckCircle2 },
              ] as const).map(({ n, label, icon: Icon }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStep(n)}
                  className={`flex items-center gap-2 flex-1 px-4 py-3 text-xs font-semibold transition-colors ${
                    step === n
                      ? "bg-background text-brand-600 border-b-2 border-brand-500"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{n}</span>
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6">
              {/* ══ Block A ════════════════════════════════════ */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Receta */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Receta <span className="text-brand-500">*</span>
                      </label>
                      <SearchableSelect
                        required
                        options={recipeOptions}
                        value={recipeId}
                        onChange={(val) => { setRecipeId(val); setBatchKgInput(""); }}
                        placeholder="Seleccionar receta..."
                        searchPlaceholder="Buscar receta..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* batch_kg */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Masa del lote (kg) <span className="text-brand-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0.001"
                        step="0.001"
                        value={batchKgInput}
                        onChange={(e) => setBatchKgInput(e.target.value)}
                        placeholder="Ej: 50.000"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Fecha planificada */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Fecha planificada</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Notas */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Notas</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observaciones..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {/* Tabla ingredientes */}
                  {recipeId && batchKg > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ingredientes del lote
                        </p>
                        <span className={`text-xs font-semibold tabular-nums ${hasPercentages && percentageSum > 0 ? "text-emerald-500" : "text-amber-500"}`}>
                          Σ = {pct(percentageSum)}%
                          {hasPercentages && percentageSum > 0 ? " ✓" : " (sin porcentajes)"}
                        </span>
                      </div>

                      {ingLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                        </div>
                      ) : !hasPercentages ? (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          Esta receta no tiene porcentajes calculados. Guarda la receta con cantidades e <code>yield_base &gt; 0</code>.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/50">
                                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ingrediente</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">%</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Requerido</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Disponible</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">OK</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {ingredientRows.map((row) => (
                                <tr key={row.id} className={`transition-colors ${row.stock_sufficient ? "" : "bg-red-50/60 dark:bg-red-900/10"}`}>
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium">{row.product_name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{row.product_sku}</p>
                                  </td>
                                  <td className="px-3 py-2.5 text-center tabular-nums text-xs">{pct(row.percentage)}%</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold">
                                    {row.required_qty.toLocaleString("es-EC", { maximumFractionDigits: 4 })} {row.stock_unit}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                                    {row.stock_available.toLocaleString("es-EC", { maximumFractionDigits: 4 })} {row.stock_unit}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {row.stock_sufficient
                                      ? <span className="text-emerald-500 text-base">✓</span>
                                      : <span className="text-red-500 text-base">✗</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ══ Block B ════════════════════════════════════ */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Selector de presentación */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Añadir presentación</label>
                      <SearchableSelect
                        options={finishedOptions}
                        value={selectedProductId}
                        onChange={setSelectedProductId}
                        placeholder="Seleccionar PRODUCTO_TERMINADO..."
                        searchPlaceholder="Buscar producto..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!selectedProductId}
                      onClick={handleAddPresentation}
                      className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0"
                    >
                      Añadir
                    </button>
                  </div>

                  {/* Lista de drafts */}
                  {drafts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                      Aún no hay presentaciones. Añade al menos una.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {drafts.map((d) => (
                        <PresentationRow
                          key={d.clientId}
                          draft={d}
                          onChange={handleDraftChange}
                          onRemove={handleDraftRemove}
                        />
                      ))}
                    </div>
                  )}

                  {/* Balance de masa */}
                  {batchKg > 0 && (
                    <MassBar assigned={totalAssignedKg} total={batchKg} />
                  )}
                </div>
              )}

              {/* ══ Block C ════════════════════════════════════ */}
              {step === 3 && (
                <div className="space-y-6">
                  {/* Resumen de validaciones */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Resumen de validaciones</p>
                    <div className="space-y-2">
                      {[
                        { ok: percentOk,         label: `Porcentajes definidos (total: ${pct(percentageSum)}%)` },
                        { ok: ingredientStockOk, label: "Stock de ingredientes suficiente" },
                        { ok: drafts.length > 0, label: `Al menos una presentación (${drafts.length})` },
                        { ok: massOk,            label: `Balance de masa dentro de tolerancia (±0.5 kg) — ${kg(totalAssignedKg)} / ${kg(batchKg)} kg` },
                      ].map(({ ok, label }) => (
                        <div key={label} className="flex items-center gap-2">
                          {ok
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <AlertCircle  className="h-4 w-4 text-red-500 shrink-0" />}
                          <span className={ok ? "text-foreground" : "text-red-600 dark:text-red-400"}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Merma */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Merma (kg) <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Se registra como <code>waste_kg</code>. El RPC calcula <code>actual_batch_kg = batch_kg − waste_kg</code>.
                    </p>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={wasteKgInput}
                      onChange={(e) => setWasteKgInput(e.target.value)}
                      className="w-40 rounded-lg border border-border bg-background px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {formError && (
                    <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{formError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
              {/* Back */}
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  ← Anterior
                </button>
              )}
              <div className="flex-1" />

              {/* Next / Submit */}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                  disabled={
                    (step === 1 && (!recipeId || batchKg <= 0)) ||
                    (step === 2 && drafts.length === 0)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canComplete || submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="h-4 w-4" />
                      Completar Lote
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── Filtros ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_META).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {filterStatus && (
            <button
              onClick={() => { setFilterStatus(""); setPage(1); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* ── Historial de órdenes ────────────────────────────── */}
        {ordersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Lote</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Receta</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Masa (kg)</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      No hay órdenes de producción unificada
                    </td>
                  </tr>
                ) : (
                  paged.map((order: UnifiedProductionOrder) => {
                    const meta   = STATUS_META[order.status] ?? STATUS_META.BORRADOR;
                    const recipe = recipes.find((r) => r.id === order.recipe_id);
                    const isExec = executing === order.id;

                    return (
                      <React.Fragment key={order.id}>
                        <tr className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {order.batch_number ?? order.id.substring(0, 8)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {recipe?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {kg(Number(order.batch_kg))}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                            {order.created_at ? formatDate(order.created_at) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                              <span className="text-xs font-medium">{meta.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center print:hidden">
                            <div className="flex justify-center flex-wrap gap-2">
                              {order.status === "BORRADOR" && (
                                <>
                                  <button
                                    onClick={() => handleExecuteExisting(order.id)}
                                    disabled={isExec}
                                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                  >
                                    {isExec ? "Ejecutando..." : "Ejecutar"}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleCancelOrder(order.id)}
                                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                </>
                              )}
                              {order.status === "COMPLETADA" && (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  ✓ Lote {order.batch_number}
                                </span>
                              )}
                            </div>
                            {rowErrors[order.id] && (
                              <p className="mt-1.5 max-w-xs mx-auto rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1 text-[10px] text-destructive leading-tight text-left">
                                {rowErrors[order.id]}
                              </p>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={page}
          totalPages={totalPages}
          from={from}
          to={to}
          total={totalPages2}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
