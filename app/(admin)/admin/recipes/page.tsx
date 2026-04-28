"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useRecipes, useRecipeIngredients } from "@features/production/hooks";
import { useState, useEffect, useCallback } from "react";

interface Product {
  id: string;
  name: string;
  sku: string;
  type: string;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  output_product_id: string;
  yield_base: number;
  yield_unit: string;
  description: string | null;
  is_active: boolean;
}

/** Formulario de ingredientes inline para una receta */
function RecipeIngredientManager({ recipe, products }: { recipe: Recipe; products: Product[] }) {
  const { ingredients, loading: ingLoading } = useRecipeIngredients(recipe.id);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", quantity: "", unit: "kg" });
  const insforge = getInsforge();

  // Productos que pueden ser ingredientes (materias primas)
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
      });

    setSaving(false);
    if (insertErr) {
      setError((insertErr as Error).message);
      return;
    }

    setForm({ product_id: "", quantity: "", unit: "kg" });
    setShowForm(false);
    setSuccess("✓ Ingrediente agregado");
    setTimeout(() => setSuccess(null), 3000);
    // Forzar re-render del hook (no tiene refetch, recargamos el hook internamente)
    window.location.reload();
  }

  async function handleDelete(ingredientId: string) {
    setDeleting(ingredientId);
    await insforge.database
      .from("recipe_ingredients")
      .delete()
      .eq("id", ingredientId);
    setDeleting(null);
    window.location.reload();
  }

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
                <span className="font-medium text-foreground">
                  {prod?.name ?? ing.product_id}
                </span>
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
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-1 space-y-1">
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
                <option value="kg">kg</option>
                <option value="lt">lt</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="unidades">und</option>
              </select>
            </div>
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

export default function AdminRecipesPage() {
  const { recipes, loading, refetch } = useRecipes();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    output_product_id: "",
    yield_base: "",
    yield_unit: "kg",
    description: "",
  });
  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, type, unit")
      .order("name");
    setProducts((data as Product[]) ?? []);
  }, [insforge]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const outputProducts = products.filter(
    (p) => p.type === "PRODUCTO_TERMINADO"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: insertErr } = await insforge.database
      .from("recipes")
      .insert({
        name: formData.name,
        output_product_id: formData.output_product_id,
        yield_base: Number(formData.yield_base),
        yield_unit: formData.yield_unit,
        description: formData.description || null,
      });

    if (insertErr) {
      setError((insertErr as Error).message);
      setSaving(false);
      return;
    }

    setFormData({ name: "", output_product_id: "", yield_base: "", yield_unit: "kg", description: "" });
    setShowForm(false);
    setSaving(false);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recetas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define las fórmulas de producción con ingredientes y rendimiento base.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Nueva Receta"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <h3 className="text-lg font-semibold">Crear Receta</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="rec-name" className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <input
                id="rec-name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Queso Doble Crema"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rec-output" className="text-xs font-medium text-muted-foreground">
                Producto Resultado *
              </label>
              <select
                id="rec-output"
                required
                value={formData.output_product_id}
                onChange={(e) => setFormData((p) => ({ ...p, output_product_id: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {outputProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rec-yield" className="text-xs font-medium text-muted-foreground">
                Rendimiento Base *
              </label>
              <div className="flex gap-2">
                <input
                  id="rec-yield"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.yield_base}
                  onChange={(e) => setFormData((p) => ({ ...p, yield_base: e.target.value }))}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="10"
                />
                <select
                  value={formData.yield_unit}
                  onChange={(e) => setFormData((p) => ({ ...p, yield_unit: e.target.value }))}
                  className="w-24 rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="kg">kg</option>
                  <option value="lt">lt</option>
                  <option value="unidades">und</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <label htmlFor="rec-desc" className="text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <input
                id="rec-desc"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Descripción opcional del proceso"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Crear Receta"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <span className="text-4xl mb-3">📋</span>
          <p className="text-sm font-medium">No hay recetas registradas</p>
          <p className="text-xs mt-1">Crea primero productos terminados y luego sus recetas</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(recipes as Recipe[]).map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.description ?? "Sin descripción"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ml-2">
                  Activa
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3">
                <div>
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {Number(r.yield_base).toLocaleString("es-EC")}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.yield_unit} base
                  </p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() =>
                      setExpandedRecipe(expandedRecipe === r.id ? null : r.id)
                    }
                    className="rounded-md px-3 py-1 text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                  >
                    {expandedRecipe === r.id ? "Ocultar" : "Ver ingredientes"}
                  </button>
                </div>
              </div>

              {/* Sección de ingredientes expandible */}
              {expandedRecipe === r.id && (
                <RecipeIngredientManager recipe={r} products={products} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
