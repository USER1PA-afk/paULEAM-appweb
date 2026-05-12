"use client";

import { useState, useEffect } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { Recipe } from "@entities/recipe";
import { Product } from "@entities/product";
import { useScalePreview, useRecipeIngredients } from "../hooks";
import { formatScaledQuantity, MEASUREMENT_UNITS } from "../lib";

/**
 * Componente: Preview de Escalado de Producción
 * 
 * Muestra la tabla pivote con cantidades base, escaladas y el stock actual.
 */
export function ProductionScalePreview({ recipeId, targetYield }: { recipeId: string | null; targetYield: number }) {
  const { recipe, scaleFactor, scaledIngredients, loading, error, canProduce } = useScalePreview(recipeId, targetYield);

  if (!recipeId) return null;

  if (loading) {
    return (
      <div className="flex justify-center p-6 border rounded-lg bg-card">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>;
  }

  if (!recipe) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <h4 className="font-semibold text-foreground">Preview de Producción</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Factor de escala: ×{scaleFactor.toFixed(4)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Objetivo</p>
          <p className="font-bold text-brand-700">{targetYield} {recipe.yield_unit}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left font-medium pb-2 pr-4">Ingrediente</th>
              <th className="text-right font-medium pb-2 px-2">Base</th>
              <th className="text-right font-medium pb-2 px-2">Requerido</th>
              <th className="text-right font-medium pb-2 px-2">Stock Disponible</th>
              <th className="text-center font-medium pb-2 pl-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {scaledIngredients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground italic">
                  Esta receta no tiene ingredientes configurados
                </td>
              </tr>
            ) : (
              scaledIngredients.map((ing) => (
                <tr key={ing.id} className="group">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-foreground text-xs">{ing.product_name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {ing.product_sku}
                      {ing.is_optional && (
                        <span className="text-amber-600 bg-amber-50 px-1 rounded-sm">Opcional</span>
                      )}
                      {ing.unit_mismatch && (
                        <span className="text-blue-600 bg-blue-50 px-1 rounded-sm" title={`Receta en ${ing.unit}, stock en ${ing.inventory_unit}`}>
                          Dif. Unidad
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs text-muted-foreground tabular-nums">
                    {ing.base_quantity} {ing.unit}
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-foreground tabular-nums">
                    {formatScaledQuantity(ing.scaled_quantity, ing.unit)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs text-muted-foreground tabular-nums">
                    {Number(ing.stock_available).toLocaleString("es-EC")} {ing.inventory_unit}
                  </td>
                  <td className="py-2.5 pl-4 text-center">
                    {ing.stock_sufficient ? (
                      <span className="inline-flex items-center text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">✓ OK</span>
                    ) : ing.is_optional ? (
                      <span className="inline-flex items-center text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">⚠️ Falta</span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium">✗ Insuficiente</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!canProduce && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive mt-2">
          <strong>No hay stock suficiente</strong> para producir la cantidad deseada. Por favor, reabastezca los ingredientes marcados en rojo.
        </div>
      )}
    </div>
  );
}


/**
 * Componente: Formulario de gestión de ingredientes de una receta.
 */
export function RecipeIngredientManager({ recipe, products }: { recipe: Recipe; products: Product[] }) {
  const { ingredients, loading: ingLoading, refetch } = useRecipeIngredients(recipe.id);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", quantity: "", unit: "kg", is_optional: false });
  const insforge = getInsforge();

  const rawMaterials = products.filter((p) => p.type === "MATERIA_PRIMA");

  async function handleAddIngredient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: insertErr } = await insforge.database
      .from("recipe_ingredients")
      .insert({
        recipe_id: recipe.id,
        product_id: form.product_id,
        quantity: Number(form.quantity),
        unit: form.unit,
        is_optional: form.is_optional,
      });

    setSaving(false);
    if (insertErr) {
      setError((insertErr as Error).message);
      return;
    }

    setForm({ product_id: "", quantity: "", unit: "kg", is_optional: false });
    setShowForm(false);
    setSuccess("✓ Ingrediente agregado");
    setTimeout(() => setSuccess(null), 3000);
    refetch(); // Ya no recarga la página
  }

  async function handleDelete(ingredientId: string) {
    setDeleting(ingredientId);
    await insforge.database
      .from("recipe_ingredients")
      .delete()
      .eq("id", ingredientId);
    setDeleting(null);
    refetch();
  }

  // Aplanar las opciones de unidades
  const unitOptions = Object.values(MEASUREMENT_UNITS).flat();

  return (
    <div className="mt-4 border-t border-border/50 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ingredientes ({ingredients.length})
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {success && (
        <p className="text-xs text-brand-600 font-medium">{success}</p>
      )}

      {ingLoading ? (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <ul className="space-y-1">
          {ingredients.length === 0 && !showForm && (
            <li className="text-xs text-muted-foreground italic">Sin ingredientes — agrega el primero</li>
          )}
          {ingredients.map((ing) => {
            const prod = products.find((p) => p.id === ing.product_id);
            return (
              <li
                key={ing.id}
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {prod?.name ?? ing.product_id}
                  </span>
                  {ing.is_optional && (
                    <span className="text-[10px] text-amber-600">Opcional</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {Number(ing.quantity).toLocaleString("es-EC")} {ing.unit}
                  </span>
                  <button
                    onClick={() => handleDelete(ing.id)}
                    disabled={deleting === ing.id}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    title="Eliminar ingrediente"
                  >
                    {deleting === ing.id ? "…" : "✕"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleAddIngredient} className="rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor={`ing-prod-${recipe.id}`} className="text-[10px] font-medium text-muted-foreground">
                Ingrediente (Materia Prima) *
              </label>
              <select
                id={`ing-prod-${recipe.id}`}
                required
                value={form.product_id}
                onChange={(e) => {
                  const p = products.find((prod) => prod.id === e.target.value);
                  setForm((f) => ({ ...f, product_id: e.target.value, unit: p?.unit ?? "kg" }));
                }}
                className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {rawMaterials.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`ing-qty-${recipe.id}`} className="text-[10px] font-medium text-muted-foreground">
                Cantidad *
              </label>
              <input
                id={`ing-qty-${recipe.id}`}
                type="number"
                required
                min="0.0001"
                step="0.0001"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="Ej: 10"
                className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`ing-unit-${recipe.id}`} className="text-[10px] font-medium text-muted-foreground">
                Unidad
              </label>
              <select
                id={`ing-unit-${recipe.id}`}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {unitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`ing-opt-${recipe.id}`}
              checked={form.is_optional}
              onChange={(e) => setForm(f => ({ ...f, is_optional: e.target.checked }))}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-3 w-3"
            />
            <label htmlFor={`ing-opt-${recipe.id}`} className="text-xs text-muted-foreground">
              Ingrediente Opcional
            </label>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Agregar Ingrediente"}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Componente: Detalle de orden de producción que muestra el consumo real
 */
export function ProductionOrderDetail({ orderId, completedAt }: { orderId: string, completedAt: string | null }) {
  // Obtenemos los movimientos del ledger que referencian a esta orden
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  useEffect(() => {
    if (!orderId || !completedAt) return;
    
    setLoading(true);
    insforge.database
      .from("inventory_ledger_view")
      .select("*")
      .eq("reference_type", "PRODUCCION")
      .eq("reference_id", orderId)
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [orderId, completedAt, insforge]);

  if (!completedAt) return null;

  if (loading) {
    return <div className="text-xs text-muted-foreground py-2">Cargando movimientos...</div>;
  }

  if (entries.length === 0) {
    return <div className="text-xs text-muted-foreground py-2 italic">No se encontraron registros de inventario</div>;
  }

  // Separar ingresos (producto terminado) y egresos (materias primas)
  const egresos = entries.filter(e => e.movement_type === 'EGRESO');
  const ingresos = entries.filter(e => e.movement_type === 'INGRESO');

  return (
    <div className="mt-3 bg-muted/30 rounded-lg p-3 border border-border/50 text-sm">
      <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">Movimientos Generados</h5>
      <ul className="space-y-1">
        {egresos.map(e => (
          <li key={e.id} className="flex justify-between items-center text-xs">
            <span className="text-red-600 font-medium">↓ {e.product_name}</span>
            <span className="tabular-nums text-muted-foreground">{e.quantity} {e.product_unit}</span>
          </li>
        ))}
        {egresos.length > 0 && ingresos.length > 0 && <div className="h-px bg-border/50 my-1" />}
        {ingresos.map(e => (
          <li key={e.id} className="flex justify-between items-center text-xs">
            <span className="text-green-600 font-medium">↑ {e.product_name}</span>
            <span className="tabular-nums text-muted-foreground font-semibold">{e.quantity} {e.product_unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
