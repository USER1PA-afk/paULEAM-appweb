"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

interface Product {
  id: string;
  name: string;
  sku: string;
  type: "MATERIA_PRIMA" | "PRODUCTO_TERMINADO";
  unit: string;
  category_id: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    type: "MATERIA_PRIMA" as "MATERIA_PRIMA" | "PRODUCTO_TERMINADO",
    unit: "kg",
    price: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("products")
      .select("*")
      .order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: insertErr } = await insforge.database
      .from("products")
      .insert({
        name: formData.name,
        sku: formData.sku,
        type: formData.type,
        unit: formData.unit,
        price: Number(formData.price) || 0,
        description: formData.description || null,
      });

    if (insertErr) {
      setError((insertErr as Error).message);
      setSaving(false);
      return;
    }

    setFormData({ name: "", sku: "", type: "MATERIA_PRIMA", unit: "kg", price: "", description: "" });
    setShowForm(false);
    setSaving(false);
    fetchProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Materias primas y productos terminados del catálogo.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Nuevo Producto"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
        >
          <h3 className="text-lg font-semibold">Registrar Producto</h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <input
                id="prod-name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Leche entera"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prod-sku" className="text-xs font-medium text-muted-foreground">
                SKU *
              </label>
              <input
                id="prod-sku"
                required
                value={formData.sku}
                onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="MP-001"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prod-type" className="text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <select
                id="prod-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    type: e.target.value as "MATERIA_PRIMA" | "PRODUCTO_TERMINADO",
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="MATERIA_PRIMA">Materia Prima</option>
                <option value="PRODUCTO_TERMINADO">Producto Terminado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prod-unit" className="text-xs font-medium text-muted-foreground">
                Unidad *
              </label>
              <select
                id="prod-unit"
                value={formData.unit}
                onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="lt">Litros (lt)</option>
                <option value="unidades">Unidades</option>
                <option value="gr">Gramos (gr)</option>
                <option value="ml">Mililitros (ml)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prod-price" className="text-xs font-medium text-muted-foreground">
                Precio (USD)
              </label>
              <input
                id="prod-price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prod-desc" className="text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <input
                id="prod-desc"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Opcional"
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
            {saving ? "Guardando..." : "Guardar Producto"}
          </button>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unidad</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Precio</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <span className="text-3xl block mb-2">🏷️</span>
                    No hay productos. Crea el primero con el botón de arriba.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.type === "MATERIA_PRIMA"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        {p.type === "MATERIA_PRIMA" ? "Materia Prima" : "Producto Terminado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {Number(p.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          p.is_active ? "bg-brand-500" : "bg-red-500"
                        }`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
