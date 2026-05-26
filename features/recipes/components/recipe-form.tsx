"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InstructionStep } from "@entities/recipe";
import { useProducts, useRecipeMutations, useRecipe } from "../hooks";
import { getAllUnits } from "../lib";
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from "lucide-react";

interface RecipeFormProps {
  /** Si se pasa un ID, se carga la receta para edición */
  recipeId?: string | null;
}

interface IngredientRow {
  key: string; // Client-side key for React
  product_id: string;
  quantity: string;
  unit: string;
}

interface StepRow {
  key: string;
  description: string;
  temperature: string;
  duration: string;
}

function generateKey() {
  return Math.random().toString(36).substring(2, 9);
}

export function RecipeForm({ recipeId }: RecipeFormProps) {
  const router = useRouter();
  const { ingredientProducts, finishedProducts } = useProducts();
  const { createRecipe, updateRecipe, replaceIngredients } = useRecipeMutations();
  const { recipe, ingredients: existingIngredients, loading: recipeLoading } = useRecipe(recipeId ?? null);

  const isEditing = !!recipeId;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputProductId, setOutputProductId] = useState("");
  const [yieldBase, setYieldBase] = useState("");
  const [yieldUnit, setYieldUnit] = useState("kg");
  const [notes, setNotes] = useState("");
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);
  const [stepRows, setStepRows] = useState<StepRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const unitOptions = getAllUnits();

  // Populate form when editing
  useEffect(() => {
    if (isEditing && recipe && !initialized) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(recipe.name);
      setDescription(recipe.description ?? "");
      setOutputProductId(recipe.output_product_id);
      setYieldBase(String(recipe.yield_base));
      setYieldUnit(recipe.yield_unit);
      setNotes(recipe.notes ?? "");

      // Populate ingredients
      const ingRows: IngredientRow[] = existingIngredients.map((ing) => ({
        key: generateKey(),
        product_id: ing.product_id,
        quantity: String(ing.quantity),
        unit: ing.unit,
      }));
      setIngredientRows(ingRows.length > 0 ? ingRows : []);

      // Populate instructions
      const instructions = (recipe.instructions ?? []) as InstructionStep[];
      const sRows: StepRow[] = instructions.map((s) => ({
        key: generateKey(),
        description: s.description,
        temperature: s.temperature ?? "",
        duration: s.duration ?? "",
      }));
      setStepRows(sRows.length > 0 ? sRows : []);

      setInitialized(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isEditing, recipe, existingIngredients, initialized]);

  // Ingredient management
  function addIngredientRow() {
    setIngredientRows((prev) => [
      ...prev,
      { key: generateKey(), product_id: "", quantity: "", unit: "kg" },
    ]);
  }

  function updateIngredientRow(key: string, field: keyof IngredientRow, value: string) {
    setIngredientRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        // Auto-set unit when selecting a product
        if (field === "product_id") {
          const prod = ingredientProducts.find((p) => p.id === value);
          if (prod) updated.unit = prod.unit;
        }
        return updated;
      })
    );
  }

  function removeIngredientRow(key: string) {
    setIngredientRows((prev) => prev.filter((r) => r.key !== key));
  }

  // Step management
  function addStepRow() {
    setStepRows((prev) => [
      ...prev,
      { key: generateKey(), description: "", temperature: "", duration: "" },
    ]);
  }

  function updateStepRow(key: string, field: keyof StepRow, value: string) {
    setStepRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function removeStepRow(key: string) {
    setStepRows((prev) => prev.filter((r) => r.key !== key));
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // 1. Validaciones explícitas de frontend
      if (!name.trim()) {
        throw new Error("El nombre de la receta es requerido.");
      }
      if (!outputProductId) {
        throw new Error("El producto resultado (terminado) es requerido.");
      }
      if (Number(yieldBase) <= 0) {
        throw new Error("El rendimiento base debe ser mayor a 0.");
      }

      // Validate ingredients
      const validIngredients = ingredientRows.filter(
        (r) => r.product_id && Number(r.quantity) > 0
      );

      if (validIngredients.length === 0) {
        throw new Error("La receta debe tener al menos un ingrediente válido con cantidad mayor a 0.");
      }

      // Build instructions
      const instructions: InstructionStep[] = stepRows
        .filter((s) => s.description.trim() !== "")
        .map((s, i) => ({
          step: i + 1,
          description: s.description.trim(),
          temperature: s.temperature.trim() || undefined,
          duration: s.duration.trim() || undefined,
        }));

      if (isEditing && recipeId) {
        // Update recipe
        await updateRecipe(recipeId, {
          name,
          output_product_id: outputProductId,
          yield_base: Number(yieldBase),
          yield_unit: yieldUnit,
          description: description || null,
          instructions,
          notes: notes || null,
        });

        // Replace ingredients
        await replaceIngredients(
          recipeId,
          validIngredients.map((r) => ({
            product_id: r.product_id,
            quantity: Number(r.quantity),
            unit: r.unit,
          }))
        );

        router.push(`/admin/recipes/${recipeId}`);
      } else {
        // Create recipe
        const newRecipe = await createRecipe({
          name,
          output_product_id: outputProductId,
          yield_base: Number(yieldBase),
          yield_unit: yieldUnit,
          description: description || null,
          instructions,
          notes: notes || null,
        });

        // Add ingredients
        if (validIngredients.length > 0 && newRecipe?.id) {
          await replaceIngredients(
            newRecipe.id,
            validIngredients.map((r) => ({
              product_id: r.product_id,
              quantity: Number(r.quantity),
              unit: r.unit,
            }))
          );
        }

        router.push("/admin/recipes");
      }
    } catch (err: unknown) {
      console.error("[RecipeForm Error]", err);
      setError(err instanceof Error ? err.message : "Error al guardar receta");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && recipeLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando receta...</span>
        </div>
      </div>
    );
  }

  const parsedYieldUnit = yieldUnit?.toLowerCase() || "";
  let yieldMin = "0.01";
  let yieldStep = "0.01";
  if (["kg", "lt"].includes(parsedYieldUnit)) {
    yieldMin = "0.01";
    yieldStep = "0.01";
  } else if (["unidad", "unidades", "libra", "libras", "unit", "units", "lb", "lbs"].includes(parsedYieldUnit)) {
    yieldMin = "1";
    yieldStep = "1";
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/recipes")}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-600 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar Receta" : "Nueva Receta"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditing
              ? "Modifica los datos de la receta de producción."
              : "Define una nueva fórmula de producción con ingredientes e instrucciones."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ================================= */}
        {/* INFORMACIÓN GENERAL               */}
        {/* ================================= */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-500" />
            <h2 className="text-base font-semibold">Información General</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nombre */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label htmlFor="recipe-name" className="text-xs font-medium text-muted-foreground">
                Nombre de la Receta *
              </label>
              <input
                id="recipe-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                placeholder="Ej: Queso Doble Crema"
              />
            </div>

            {/* Producto Resultado */}
            <div className="space-y-1.5">
              <label htmlFor="recipe-output" className="text-xs font-medium text-muted-foreground">
                Producto Resultado *
              </label>
              <select
                id="recipe-output"
                required
                value={outputProductId}
                onChange={(e) => setOutputProductId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              >
                <option value="">Seleccionar producto terminado...</option>
                {finishedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Rendimiento Base */}
            <div className="space-y-1.5">
              <label htmlFor="recipe-yield" className="text-xs font-medium text-muted-foreground">
                Rendimiento Base *
              </label>
              <div className="flex gap-2">
                <input
                  id="recipe-yield"
                  type="number"
                  required
                  min={yieldMin}
                  step={yieldStep}
                  value={yieldBase}
                  onChange={(e) => setYieldBase(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  placeholder="Ej: 10"
                />
                <select
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  aria-label="Unidad del rendimiento base"
                  className="w-28 rounded-lg border border-border bg-background px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                >
                  {unitOptions.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <label htmlFor="recipe-desc" className="text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <textarea
                id="recipe-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
                placeholder="Descripción del proceso productivo..."
              />
            </div>
          </div>
        </section>

        {/* ================================= */}
        {/* INGREDIENTES + INSTRUCCIONES      */}
        {/* ================================= */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
              <h2 className="text-base font-semibold">Ingredientes</h2>
              <span className="text-xs text-muted-foreground">({ingredientRows.length})</span>
            </div>
            <button
              type="button"
              onClick={addIngredientRow}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Agregar Ingrediente
            </button>
          </div>

          {ingredientRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">No hay ingredientes agregados</p>
              <p className="text-xs mt-1">
                Haz clic en &quot;Agregar Ingrediente&quot; para comenzar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Column headers — desktop only */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                <div className="col-span-5">Ingrediente</div>
                <div className="col-span-3">Cantidad</div>
                <div className="col-span-3">Unidad</div>
                <div className="col-span-1" />
              </div>

              {ingredientRows.map((row, idx) => {
                const parsedRowUnit = row.unit?.toLowerCase() || "";
                let rowMin = "0.01";
                let rowStep = "0.01";
                if (["kg", "lt"].includes(parsedRowUnit)) {
                  rowMin = "0.01";
                  rowStep = "0.01";
                } else if (["unidad", "unidades", "libra", "libras", "unit", "units", "lb", "lbs"].includes(parsedRowUnit)) {
                  rowMin = "1";
                  rowStep = "1";
                }
                return (
                  <div
                  key={row.key}
                  className="rounded-lg border border-border/50 bg-muted/30 p-3 hover:border-border hover:bg-muted/50 transition-all duration-150"
                >
                  {/* Desktop: 12-col grid / Mobile: stacked */}
                  <div className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center">

                    {/* # + Product — full width on mobile */}
                    <div className="sm:col-span-5 flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950 text-[10px] font-extrabold select-none shadow-sm"
                      >
                        {idx + 1}
                      </span>
                      <select
                        required
                        aria-label={`Ingrediente ${idx + 1}`}
                        value={row.product_id}
                        onChange={(e) => updateIngredientRow(row.key, "product_id", e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                      >
                        <option value="">Seleccionar ingrediente...</option>
                        {ingredientProducts.filter(p => p.type === "MATERIA_PRIMA").length > 0 && (
                          <optgroup label="Materias Primas">
                            {ingredientProducts.filter(p => p.type === "MATERIA_PRIMA").map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </optgroup>
                        )}
                        {ingredientProducts.filter(p => p.type === "INSUMO").length > 0 && (
                          <optgroup label="Insumos">
                            {ingredientProducts.filter(p => p.type === "INSUMO").map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Quantity + Unit + Delete — flex row on mobile, grid cols on sm+ */}
                    <div className="flex items-center gap-2 sm:contents">
                      <div className="flex-1 sm:col-span-3">
                        <input
                          type="number"
                          required
                          min={rowMin}
                          step={rowStep}
                          aria-label={`Ingrediente ${idx + 1}: cantidad`}
                          value={row.quantity}
                          onChange={(e) => updateIngredientRow(row.key, "quantity", e.target.value)}
                          placeholder="Cantidad"
                          className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring tabular-nums transition-shadow"
                        />
                      </div>
                      <div className="flex-1 sm:col-span-3">
                        <select
                          aria-label={`Ingrediente ${idx + 1}: unidad de medida`}
                          value={row.unit}
                          onChange={(e) => updateIngredientRow(row.key, "unit", e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        >
                          {unitOptions.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="shrink-0 sm:col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeIngredientRow(row.key)}
                          aria-label={`Eliminar ingrediente ${idx + 1}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </section>

        {/* ================================= */}
        {/* INSTRUCCIONES DE PREPARACIÓN      */}
        {/* ================================= */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-base font-semibold">Instrucciones de Preparación</h2>
              <span className="text-xs text-muted-foreground">({stepRows.length})</span>
            </div>
            <button
              type="button"
              onClick={addStepRow}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Agregar Paso
            </button>
          </div>

          {stepRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">No hay instrucciones de preparación</p>
              <p className="text-xs mt-1">
                Agrega pasos como &quot;Calentar leche a 70°C&quot; o &quot;Mezclar por 10 minutos&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stepRows.map((step, idx) => (
                <div
                  key={step.key}
                  className="rounded-lg border border-border/50 bg-muted/30 p-4 hover:border-border hover:bg-muted/50 transition-all duration-150"
                >
                  <div className="flex items-start gap-3">
                    {/* Grip + step number (high contrast circle badge) */}
                    <div aria-hidden="true" className="flex items-center gap-2 shrink-0 pt-2.5">
                      <GripVertical className="h-4 w-4 text-muted-foreground/45" />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white dark:bg-amber-500 dark:text-zinc-950 text-xs font-bold select-none shadow-sm">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Content: description | temp + duration (side by side on lg) */}
                    <div className="flex-1 grid gap-3 xl:grid-cols-[1fr_260px]">
                      {/* Description */}
                      <textarea
                        aria-label={`Paso ${idx + 1}: descripción de la instrucción`}
                        value={step.description}
                        onChange={(e) => updateStepRow(step.key, "description", e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
                        placeholder={`Paso ${idx + 1}: Describir la instrucción...`}
                      />

                      {/* Temperature + Duration — siempre side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label
                            htmlFor={`step-${step.key}-temp`}
                            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            Temperatura
                          </label>
                          <input
                            id={`step-${step.key}-temp`}
                            value={step.temperature}
                            onChange={(e) => updateStepRow(step.key, "temperature", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            placeholder="Ej: 70°C"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`step-${step.key}-dur`}
                            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            Duración
                          </label>
                          <input
                            id={`step-${step.key}-dur`}
                            value={step.duration}
                            onChange={(e) => updateStepRow(step.key, "duration", e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            placeholder="Ej: 10 min"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeStepRow(step.key)}
                      aria-label={`Eliminar paso ${idx + 1}`}
                      className="shrink-0 mt-2 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        </div>{/* end lg:grid-cols-2 */}

        {/* ================================= */}
        {/* OBSERVACIONES                     */}
        {/* ================================= */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div aria-hidden="true" className="h-2 w-2 rounded-full bg-purple-500" />
            <h2 id="recipe-notes-heading" className="text-base font-semibold">Observaciones</h2>
          </div>

          <textarea
            aria-labelledby="recipe-notes-heading"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
            placeholder="Notas adicionales, especificaciones técnicas, consideraciones de calidad..."
          />
        </section>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/admin/recipes")}
            className="rounded-lg border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving
              ? "Guardando..."
              : isEditing
                ? "Guardar Cambios"
                : "Crear Receta"}
          </button>
        </div>
      </form>
    </div>
  );
}
