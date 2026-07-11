"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRecipe } from "../hooks";
import { useRole } from "@features/auth/hooks";
import { RequestDeletionDialog } from "@features/deletion-requests";
import { InstructionStep, INGREDIENT_ROLE_LABELS } from "@entities/recipe";
import { ArrowLeft, Printer, Pencil, Beaker, Thermometer, Clock, FileText, Trash2 } from "lucide-react";

interface RecipeDetailProps {
  recipeId: string;
}

export function RecipeDetail({ recipeId }: RecipeDetailProps) {
  const router = useRouter();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "operario";
  const { recipe, ingredients, outputProduct, ingredientProducts, loading, error } =
    useRecipe(recipeId);
  const [showRequestDelete, setShowRequestDelete] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/admin/recipes")}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-600 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error ?? "Receta no encontrada"}
        </div>
      </div>
    );
  }

  const instructions = (recipe.instructions ?? []) as InstructionStep[];

  return (
    <>
    <div className="space-y-8 print:hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/admin/recipes")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-600 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{recipe.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ficha técnica de producción
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          {isStaff && recipe.is_active !== false && (
            <button
              onClick={() => router.push(`/admin/recipes/${recipeId}/edit`)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          )}
          {isStaff && recipe.is_active !== false && (
            <button
              onClick={() => setShowRequestDelete(true)}
              title="Solicitar eliminación (requiere aprobación de admin)"
              className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* ================================= */}
      {/* INFORMACIÓN GENERAL               */}
      {/* ================================= */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-5">
          <Beaker className="h-4 w-4 text-brand-600" />
          <h2 className="text-base font-semibold">Información General</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Nombre
            </p>
            <p className="text-sm font-medium text-foreground">{recipe.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Producto Final
            </p>
            <p className="text-sm font-medium text-foreground">
              {outputProduct?.name ?? "—"}
              {outputProduct?.sku && (
                <span className="text-muted-foreground ml-1">({outputProduct.sku})</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Rendimiento Base
            </p>
            <p className="text-sm font-bold text-brand-700 tabular-nums">
              {Number(recipe.yield_base).toLocaleString("es-EC", {
                minimumFractionDigits: ["kg", "lt"].includes(recipe.yield_unit?.toLowerCase() || "") ? 2 : 0,
                maximumFractionDigits: ["kg", "lt"].includes(recipe.yield_unit?.toLowerCase() || "") ? 2 : 2,
                useGrouping: false
              })} {recipe.yield_unit}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Estado
            </p>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              {recipe.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
        </div>

        {recipe.description && (
          <div className="mt-5 pt-4 border-t border-border/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Descripción
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{recipe.description}</p>
          </div>
        )}
      </section>

      {/* ================================= */}
      {/* TABLA DE INGREDIENTES             */}
      {/* ================================= */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-5">
          <FileText className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-semibold">Ingredientes</h2>
          <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {ingredients.length}
          </span>
        </div>

        {ingredients.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground italic">
            Esta receta no tiene ingredientes configurados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-center font-semibold pb-3 pr-4 w-12">#</th>
                  <th className="text-center font-semibold pb-3 pr-4">Ingrediente</th>
                  <th className="text-center font-semibold pb-3 pr-4">SKU</th>
                  <th className="text-center font-semibold pb-3 pr-4">Cantidad</th>
                  <th className="text-center font-semibold pb-3 pr-4">Unidad</th>
                  <th className="text-center font-semibold pb-3">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ingredients.map((ing, idx) => {
                  const prod = ingredientProducts[ing.product_id];
                  return (
                    <tr key={ing.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 text-center text-xs font-bold text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 pr-4 text-center font-medium text-foreground">
                        {prod?.name ?? ing.product_id}
                      </td>
                      <td className="py-3 pr-4 text-center text-xs text-muted-foreground font-mono">
                        {prod?.sku ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-center font-semibold tabular-nums">
                        {Number(ing.quantity).toLocaleString("es-EC", {
                          minimumFractionDigits: ["kg", "lt"].includes(ing.unit?.toLowerCase() || "") ? 2 : 0,
                          maximumFractionDigits: ["kg", "lt"].includes(ing.unit?.toLowerCase() || "") ? 2 : 2,
                          useGrouping: false
                        })}
                      </td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">{ing.unit}</td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Materia Prima
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================= */}
      {/* INSTRUCCIONES DE PREPARACIÓN      */}
      {/* ================================= */}
      {instructions.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-5">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-base font-semibold">Instrucciones de Preparación</h2>
            <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {instructions.length} pasos
            </span>
          </div>

          <div className="space-y-4">
            {instructions.map((step, idx) => (
              <div
                key={idx}
                className="flex gap-4 rounded-lg border border-border/50 bg-muted/20 p-4"
              >
                <div className="flex items-start">
                  <span className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold shrink-0 dark:bg-amber-900/30 dark:text-amber-400">
                    {step.step}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    {step.description}
                  </p>
                  {(step.temperature || step.duration) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {step.temperature && (
                        <span className="flex items-center gap-1">
                          <Thermometer className="h-3.5 w-3.5 text-red-500" />
                          {step.temperature}
                        </span>
                      )}
                      {step.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                          {step.duration}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================================= */}
      {/* OBSERVACIONES                     */}
      {/* ================================= */}
      {recipe.notes && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
            <FileText className="h-4 w-4 text-purple-600" />
            <h2 className="text-base font-semibold">Observaciones</h2>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {recipe.notes}
          </p>
        </section>
      )}
    </div>

    {/* ════════════════════════════════════════════════════
        FICHA TÉCNICA DE PRODUCCIÓN — solo visible al imprimir
        Sin clases Tailwind de tarjeta/sombra/color web.
        ════════════════════════════════════════════════════ */}
    <div className="hidden print:block ficha-tecnica">

      {/* ── MEMBRETE ─────────────────────────────────────── */}
      <div className="ficha-header">
        <div className="ficha-header-inner">
          <div className="ficha-header-logo">
            <div style={{ fontWeight: "bold", fontSize: "13pt", lineHeight: 1.2 }}>
              PLANTA DE ALIMENTOS ULEAM
            </div>
            <div style={{ fontSize: "9pt", marginTop: 2 }}>
              Universidad Laica Eloy Alfaro de Manabí — Extensión Chone
            </div>
          </div>
          <div className="ficha-header-meta">
            <div style={{ fontSize: "8.5pt", lineHeight: 1.7 }}>
              <div><strong>Código:</strong> FT-{recipeId.slice(0, 8).toUpperCase()}</div>
              <div><strong>Versión:</strong> 1.0</div>
              <div>
                <strong>Fecha:</strong>{" "}
                {new Date().toLocaleDateString("es-EC", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="ficha-doc-title">FICHA TÉCNICA DE PRODUCCIÓN</div>
      </div>

      {/* ── 1. INFORMACIÓN GENERAL ───────────────────────── */}
      <div className="ficha-section-title" style={{ marginTop: 10 }}>
        1. Información General
      </div>
      <table className="ficha-table">
        <tbody>
          <tr>
            <td className="ficha-label">Nombre de la Receta:</td>
            <td className="ficha-value" colSpan={3}>{recipe.name}</td>
          </tr>
          <tr>
            <td className="ficha-label">Producto Final:</td>
            <td className="ficha-value">
              {outputProduct?.name ?? "—"}
              {outputProduct?.sku ? ` (SKU: ${outputProduct.sku})` : ""}
            </td>
            <td className="ficha-label">Estado:</td>
            <td className="ficha-value">{recipe.is_active ? "Activa" : "Inactiva"}</td>
          </tr>
          <tr>
            <td className="ficha-label">Rendimiento Base:</td>
            <td className="ficha-value">
              {Number(recipe.yield_base).toLocaleString("es-EC", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: false,
              })}{" "}{recipe.yield_unit}
            </td>
            <td className="ficha-label">Fecha Emisión:</td>
            <td className="ficha-value">
              {new Date().toLocaleDateString("es-EC", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </td>
          </tr>
          {recipe.description && (
            <tr>
              <td className="ficha-label">Descripción:</td>
              <td className="ficha-value" colSpan={3}>{recipe.description}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── 2. INGREDIENTES ──────────────────────────────── */}
      <div className="ficha-section-title">2. Ingredientes</div>
      {ingredients.length === 0 ? (
        <div style={{
          border: "1px solid black",
          borderTop: "none",
          padding: "6px 8px",
          fontSize: "10pt",
          fontStyle: "italic",
        }}>
          No se han configurado ingredientes para esta receta.
        </div>
      ) : (
        <table className="ficha-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>#</th>
              <th style={{ width: "35%", textAlign: "left" }}>Ingrediente</th>
              <th style={{ width: "18%" }}>SKU</th>
              <th style={{ width: "14%" }}>Cantidad</th>
              <th style={{ width: "10%" }}>Unidad</th>
              <th style={{ width: "18%" }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing, idx) => {
              const prod = ingredientProducts[ing.product_id];
              return (
                <tr key={ing.id}>
                  <td style={{ textAlign: "center", fontWeight: "bold" }}>{idx + 1}</td>
                  <td>{prod?.name ?? ing.product_id}</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "9pt" }}>
                    {prod?.sku ?? "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {Number(ing.quantity).toLocaleString("es-EC", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                      useGrouping: false,
                    })}
                  </td>
                  <td style={{ textAlign: "center" }}>{ing.unit}</td>
                  <td style={{ textAlign: "center", fontSize: "9pt" }}>
                    {INGREDIENT_ROLE_LABELS[ing.ingredient_role] ?? ing.ingredient_role}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── 3. INSTRUCCIONES DE PREPARACIÓN ─────────────── */}
      {instructions.length > 0 && (
        <>
          <div className="ficha-section-title">3. Instrucciones de Preparación</div>
          <div style={{ border: "1px solid black" }}>
            {/* Encabezado de columnas */}
            <div style={{
              display: "table",
              width: "100%",
              borderBottom: "1px solid black",
              background: "#e5e5e5",
            }}>
              <div style={{
                display: "table-cell",
                width: 32,
                padding: "3px 6px",
                borderRight: "1px solid black",
                fontWeight: "bold",
                textAlign: "center",
                fontSize: "9pt",
              }}>
                Paso
              </div>
              <div style={{
                display: "table-cell",
                padding: "3px 8px",
                fontWeight: "bold",
                fontSize: "9pt",
              }}>
                Descripción del Procedimiento
              </div>
            </div>
            {instructions.map((step) => (
              <div key={step.step} className="ficha-step">
                <div className="ficha-step-num">{step.step}</div>
                <div className="ficha-step-body">
                  <div>{step.description}</div>
                  {(step.temperature || step.duration) && (
                    <div className="ficha-step-meta">
                      {step.temperature && <span>Temperatura: {step.temperature}</span>}
                      {step.temperature && step.duration && (
                        <span style={{ margin: "0 8px" }}>|</span>
                      )}
                      {step.duration && <span>Duración: {step.duration}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 4. OBSERVACIONES (condicional) ───────────────── */}
      {recipe.notes && (
        <>
          <div className="ficha-section-title" style={{ marginTop: 10 }}>
            {instructions.length > 0 ? "4." : "3."} Observaciones
          </div>
          <div className="ficha-obs">{recipe.notes}</div>
        </>
      )}

      {/* ── PIE DE FIRMAS ────────────────────────────────── */}
      <div className="ficha-signatures">
        <div className="ficha-sig-cell">
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>Elaborado por:</div>
          <div className="ficha-sig-line">Firma / Fecha</div>
        </div>
        <div className="ficha-sig-cell">
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>Revisado por:</div>
          <div className="ficha-sig-line">Firma / Fecha</div>
        </div>
        <div className="ficha-sig-cell">
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>Aprobado por:</div>
          <div className="ficha-sig-line">Firma / Fecha</div>
        </div>
      </div>

      {/* ── Nota al pie ──────────────────────────────────── */}
      <div className="ficha-footer-note">
        Código: FT-{recipeId.slice(0, 8).toUpperCase()} — Generado el{" "}
        {new Date().toLocaleString("es-EC")} — PAuleam ERP / Planta de Alimentos ULEAM
      </div>

    </div>
    <RequestDeletionDialog
      open={showRequestDelete}
      onClose={() => setShowRequestDelete(false)}
      onSubmitted={() => router.push("/admin/recipes")}
      entityType="recipe"
      entityId={recipe.id}
      entityLabel={recipe.name}
    />
    </>
  );
}
