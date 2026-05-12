"use client";

import { useRouter } from "next/navigation";
import { useRecipe } from "../hooks";
import { InstructionStep } from "@entities/recipe";
import { ArrowLeft, Printer, Pencil, Beaker, Thermometer, Clock, FileText } from "lucide-react";

interface RecipeDetailProps {
  recipeId: string;
}

export function RecipeDetail({ recipeId }: RecipeDetailProps) {
  const router = useRouter();
  const { recipe, ingredients, outputProduct, ingredientProducts, loading, error } =
    useRecipe(recipeId);

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
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/recipes")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ficha técnica de producción
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            onClick={() => router.push(`/admin/recipes/${recipeId}/edit`)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Print Header — solo visible al imprimir */}
      <div className="hidden print:block print:mb-4">
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold">Planta de Alimentos Uleam</h1>
            <p className="text-sm font-medium">FICHA TÉCNICA DE PRODUCCIÓN</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">{recipe.name}</p>
            <p>Fecha: {new Date().toLocaleDateString("es-EC")}</p>
          </div>
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
              {Number(recipe.yield_base).toLocaleString("es-EC")} {recipe.yield_unit}
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
                  <th className="text-left font-semibold pb-3 pr-4 w-12">#</th>
                  <th className="text-left font-semibold pb-3 pr-4">Ingrediente</th>
                  <th className="text-left font-semibold pb-3 pr-4">SKU</th>
                  <th className="text-right font-semibold pb-3 pr-4">Cantidad</th>
                  <th className="text-left font-semibold pb-3 pr-4">Unidad</th>
                  <th className="text-left font-semibold pb-3">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ingredients.map((ing, idx) => {
                  const prod = ingredientProducts[ing.product_id];
                  return (
                    <tr key={ing.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 text-xs font-bold text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {prod?.name ?? ing.product_id}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground font-mono">
                        {prod?.sku ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                        {Number(ing.quantity).toLocaleString("es-EC")}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{ing.unit}</td>
                      <td className="py-3">
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
  );
}
