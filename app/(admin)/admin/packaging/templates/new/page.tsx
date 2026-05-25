"use client";

import { usePackagingTemplates, usePackagingTemplateMutations } from "@features/packaging";
import { getInsforge } from "@shared/lib/insforge/client";
import { Product, PRODUCT_TYPE_LABELS } from "@entities/product";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trash2, Plus } from "lucide-react";

interface MaterialRow {
  material_product_id: string;
  quantity_per_unit: number | "";
  unit: string;
  notes: string;
}

const EMPTY_MATERIAL: MaterialRow = {
  material_product_id: "",
  quantity_per_unit: "",
  unit: "unidades",
  notes: "",
};

export default function NewPackagingTemplatePage() {
  const router = useRouter();
  const { refetch } = usePackagingTemplates();
  const { createTemplate } = usePackagingTemplateMutations(refetch);

  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [form, setForm] = useState({
    name: "",
    finished_product_id: "",
    output_product_id: "",  // puede ser igual o diferente al granel
    bulk_qty_per_unit: "",
    bulk_unit: "kg",
    output_unit: "unidad",
    description: "",
  });

  const [materials, setMaterials] = useState<MaterialRow[]>([{ ...EMPTY_MATERIAL }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, type, unit")
      .eq("is_active", true)
      .order("name");

    const all = (data as Product[]) ?? [];
    setFinishedProducts(all.filter((p) => p.type === "PRODUCTO_TERMINADO"));
    setPackagingMaterials(all.filter((p) => p.type === "ENVASE_EMPAQUE"));
    setLoadingProducts(false);
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function addMaterial() {
    setMaterials((prev) => [...prev, { ...EMPTY_MATERIAL }]);
  }

  function removeMaterial(index: number) {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMaterial(index: number, field: keyof MaterialRow, value: string | number) {
    setMaterials((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validMaterials = materials.filter(
      (m) => m.material_product_id && Number(m.quantity_per_unit) > 0
    );

    setSaving(true);
    const { error: createErr } = await createTemplate(
      {
        name: form.name,
        finished_product_id: form.finished_product_id,
        output_product_id: form.output_product_id || form.finished_product_id,
        bulk_qty_per_unit: Number(form.bulk_qty_per_unit),
        bulk_unit: form.bulk_unit,
        output_unit: form.output_unit,
        description: form.description || null,
      },
      validMaterials.map((m) => ({
        material_product_id: m.material_product_id,
        quantity_per_unit: Number(m.quantity_per_unit),
        unit: m.unit,
        notes: m.notes || null,
      }))
    );
    setSaving(false);

    if (createErr) {
      setError(createErr);
      return;
    }

    router.push("/admin/packaging/templates");
  }

  const selectedFinished = finishedProducts.find((p) => p.id === form.finished_product_id);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/packaging/templates"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Plantillas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Plantilla de Empaque</h1>
      </div>

      {loadingProducts ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ─── Información básica ─── */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold">Información de la plantilla</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Queso 500g Vacío"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Producto a granel */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Producto a Granel *
                </label>
                {finishedProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay productos terminados. Crea uno primero.
                  </p>
                ) : (
                  <select
                    required
                    value={form.finished_product_id}
                    onChange={(e) => {
                      const p = finishedProducts.find((pr) => pr.id === e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        finished_product_id: e.target.value,
                        output_product_id: e.target.value, // por defecto, mismo producto
                        bulk_unit: p?.unit ?? "kg",
                      }));
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Seleccionar producto...</option>
                    {finishedProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — {p.unit}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-muted-foreground">
                  El producto terminado a granel que se empacará.
                </p>
              </div>

              {/* Cantidad por unidad + unidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Cantidad por unidad empacada *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0.001"
                    step="0.001"
                    value={form.bulk_qty_per_unit}
                    onChange={(e) => setForm((p) => ({ ...p, bulk_qty_per_unit: e.target.value }))}
                    placeholder="0.500"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={form.bulk_unit}
                    onChange={(e) => setForm((p) => ({ ...p, bulk_unit: e.target.value }))}
                    placeholder="kg"
                    className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ej: 0.5 kg → cada unidad empacada consume 500g de granel.
                </p>
              </div>

              {/* Unidad de salida */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Unidad del producto empacado *
                </label>
                <input
                  required
                  value={form.output_unit}
                  onChange={(e) => setForm((p) => ({ ...p, output_unit: e.target.value }))}
                  placeholder="unidad, paquete, caja..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Producto de salida (puede ser diferente al granel para nueva presentación) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Producto de salida (presentación)
                </label>
                <select
                  value={form.output_product_id}
                  onChange={(e) => setForm((p) => ({ ...p, output_product_id: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Mismo que el granel</option>
                  {finishedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Si la presentación tiene su propio SKU (Queso 500g vs. Queso a granel),
                  selecciónalo aquí.
                </p>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Descripción opcional..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>

            {/* Resumen visual */}
            {selectedFinished && Number(form.bulk_qty_per_unit) > 0 && (
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Resumen</p>
                <p>
                  <span className="font-semibold">1 {form.output_unit}</span>
                  {" "}consume{" "}
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {form.bulk_qty_per_unit} {form.bulk_unit}
                  </span>
                  {" "}de{" "}
                  <span className="font-semibold">{selectedFinished.name}</span>
                </p>
              </div>
            )}
          </div>

          {/* ─── Materiales de empaque ─── */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Materiales de Empaque</h3>
              <button
                type="button"
                onClick={addMaterial}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3 w-3" /> Agregar material
              </button>
            </div>

            {packagingMaterials.length === 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                No hay productos de tipo <strong>Envase/Empaque</strong> registrados.
                Agrega los materiales en la sección de Productos con tipo &quot;Envase / Empaque&quot;.
              </div>
            )}

            {materials.map((mat, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-4 items-end border border-border/50 rounded-lg p-3 bg-muted/20">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Material *</label>
                  <select
                    value={mat.material_product_id}
                    onChange={(e) => updateMaterial(index, "material_product_id", e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Seleccionar material...</option>
                    {packagingMaterials.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cant. por unidad *</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={mat.quantity_per_unit}
                      onChange={(e) => updateMaterial(index, "quantity_per_unit", e.target.value)}
                      placeholder="1"
                      className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      value={mat.unit}
                      onChange={(e) => updateMaterial(index, "unit", e.target.value)}
                      placeholder="und"
                      className="w-16 rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeMaterial(index)}
                    disabled={materials.length === 1}
                    className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:text-destructive hover:border-destructive/50 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !form.finished_product_id || !form.bulk_qty_per_unit}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar Plantilla"}
            </button>
            <Link
              href="/admin/packaging/templates"
              className="rounded-lg border border-border bg-background px-6 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
