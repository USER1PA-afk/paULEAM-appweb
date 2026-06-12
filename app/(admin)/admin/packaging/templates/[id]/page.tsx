"use client";

import {
  usePackagingTemplate,
  usePackagingTemplates,
  usePackagingTemplateMutations,
} from "@features/packaging";
import { getInsforge } from "@shared/lib/insforge/client";
import { Product } from "@entities/product";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trash2, Plus, ArrowRight, Package, Layers, PackageCheck, AlertTriangle } from "lucide-react";

interface MaterialRow {
  material_product_id: string;
  quantity_per_unit: number | "";
  unit: string;
  notes: string;
}

const EMPTY_MATERIAL: MaterialRow = {
  material_product_id: "",
  quantity_per_unit: "",
  unit: "",
  notes: "",
};

export default function EditPackagingTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const { refetch } = usePackagingTemplates();
  const { template, materials: existingMaterials, loading: loadingTemplate } =
    usePackagingTemplate(templateId);
  const { updateTemplate } = usePackagingTemplateMutations(refetch);

  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [outputProducts, setOutputProducts] = useState<Product[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [form, setForm] = useState({
    name: "",
    finished_product_id: "",
    output_product_id: "",
    bulk_qty_per_unit: "",
    bulk_unit: "kg",
    output_unit: "unidad",
    description: "",
  });

  const [materials, setMaterials] = useState<MaterialRow[]>([{ ...EMPTY_MATERIAL }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, type, unit")
      .eq("is_active", true)
      .order("name");

    const all = (data as Product[]) ?? [];
    setFinishedProducts(all.filter((p) => p.type === "PRODUCTO_A_GRANEL"));
    setOutputProducts(all.filter((p) => p.type === "PRODUCTO_TERMINADO"));
    setPackagingMaterials(all.filter((p) => p.type === "ENVASE_EMPAQUE" || p.type === "MATERIAL_SECUNDARIO"));
    setLoadingProducts(false);
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Pre-llenar form cuando carga la plantilla.
  // Guard con loadingTemplate: el hook setea loading=false en el finally block,
  // DESPUÉS de que tanto template como materials hayan sido actualizados.
  // Sin este guard, el effect corre con existingMaterials=[] (template llega antes
  // que los materiales), marca initialized=true y nunca vuelve a cargar los materiales.
  useEffect(() => {
    if (loadingTemplate || !template || initialized) return;
    setForm({
      name: template.name,
      finished_product_id: template.finished_product_id,
      output_product_id: template.output_product_id,
      bulk_qty_per_unit: String(template.bulk_qty_per_unit),
      bulk_unit: template.bulk_unit,
      output_unit: template.output_unit,
      description: template.description ?? "",
    });
    setMaterials(
      existingMaterials.length > 0
        ? existingMaterials.map((m) => ({
            material_product_id: m.material_product_id,
            quantity_per_unit: Number(m.quantity_per_unit),
            unit: m.unit,
            notes: m.notes ?? "",
          }))
        : [{ ...EMPTY_MATERIAL }]
    );
    setInitialized(true);
  }, [loadingTemplate, template, existingMaterials, initialized]);

  function addMaterial() {
    setMaterials((prev) => [...prev, { ...EMPTY_MATERIAL }]);
  }

  function removeMaterial(index: number) {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMaterial(index: number, field: keyof MaterialRow, value: string | number) {
    setMaterials((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        if (field === "material_product_id") {
          const mat = packagingMaterials.find((p) => p.id === value);
          // Unit is read-only and always derived from the selected product
          return { ...m, [field]: value as string, unit: mat?.unit ?? "" };
        }
        return { ...m, [field]: value };
      })
    );
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);

    const validMaterials = materials.filter(
      (m) => m.material_product_id && Number(m.quantity_per_unit) > 0
    );

    setSaving(true);
    const { error: updateErr } = await updateTemplate(
      templateId,
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

    if (updateErr) {
      setError(updateErr);
      return;
    }

    router.push("/admin/packaging/templates");
  }

  const selectedGranel = finishedProducts.find((p) => p.id === form.finished_product_id);
  const selectedOutput = outputProducts.find((p) => p.id === form.output_product_id);
  const noOutputSelected = !form.output_product_id || form.output_product_id === form.finished_product_id;
  const canSubmit = !!form.finished_product_id && !!form.bulk_qty_per_unit && !!form.name;
  const isLoading = loadingTemplate || loadingProducts;

  const FlowStrip = (
    <div className="rounded-lg border border-border bg-card px-4 py-2 flex items-center gap-2 text-xs overflow-x-auto">
      <Layers className="h-3.5 w-3.5 text-teal-600 shrink-0" />
      <span className="font-semibold text-teal-700 dark:text-teal-400 truncate max-w-[160px]">
        {selectedGranel?.name ?? "Producto a Granel"}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {form.bulk_qty_per_unit ? (
        <span className="font-mono bg-muted rounded px-1.5 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
          {form.bulk_qty_per_unit} {form.bulk_unit}
        </span>
      ) : (
        <span className="text-muted-foreground shrink-0">…cantidad…</span>
      )}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">
        {materials.filter((m) => m.material_product_id).length > 0
          ? `${materials.filter((m) => m.material_product_id).length} material(es)`
          : "materiales"}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <PackageCheck className="h-3.5 w-3.5 text-brand-600 shrink-0" />
      <span className="font-semibold text-brand-700 dark:text-brand-400 truncate max-w-[160px]">
        {selectedOutput?.name ?? "Producto Terminado"}
      </span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header + flow strip en una fila en lg */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/admin/packaging/templates" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Plantillas
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Editar Plantilla de Empaque</h1>
        </div>
        <div className="lg:flex-1 lg:max-w-xl">{FlowStrip}</div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : !template ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            Plantilla no encontrada.{" "}
            <Link href="/admin/packaging/templates" className="underline font-medium">Volver</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* ── Dos columnas en lg ── */}
          <div className="grid gap-3 lg:grid-cols-[3fr_2fr] lg:items-stretch">

            {/* ─── Columna izquierda: Conversión ─── */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold shrink-0">1</span>
                <h3 className="text-sm font-semibold">Conversión granel → presentación</h3>
              </div>
              <div className="p-4 space-y-3 flex-1">

                {/* Nombre */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Nombre <span className="text-destructive">*</span>
                    <span className="font-normal text-[10px] text-muted-foreground block mt-0.5">Identifica esta plantilla en listas y reportes</span>
                  </label>
                  <input required value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Queso Fresco 500g en bolsa"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Granel → Qty → Terminado */}
                <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] items-end">
                  {/* Granel */}
                  <div className="space-y-1">
                    <label className="flex flex-wrap items-center gap-1 text-xs font-semibold text-foreground">
                      <Layers className="h-3 w-3 text-teal-600" />
                      Producto a Granel <span className="text-destructive">*</span>
                      <span className="font-normal text-[10px] text-muted-foreground w-full leading-none">Sale de producción, será empacado aquí</span>
                    </label>
                    {finishedProducts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                        <p className="text-xs text-amber-700 dark:text-amber-400">Sin productos.{" "}
                          <Link href="/admin/products" target="_blank" className="underline">Crear →</Link>
                        </p>
                      </div>
                    ) : (
                      <select required value={form.finished_product_id}
                        onChange={(e) => {
                          const p = finishedProducts.find((pr) => pr.id === e.target.value);
                          setForm((prev) => ({ ...prev, finished_product_id: e.target.value, output_product_id: "", bulk_unit: p?.unit ?? "kg" }));
                        }}
                        className="w-full rounded-lg border border-teal-300 dark:border-teal-700 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                        <option value="">Seleccionar...</option>
                        {finishedProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.unit}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Flecha + cantidad (desktop) */}
                  <div className="flex flex-col items-center gap-0.5 pb-0.5 hidden md:flex">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex gap-1">
                      <input type="number" required min="0.001" step="any" value={form.bulk_qty_per_unit}
                        onChange={(e) => setForm((p) => ({ ...p, bulk_qty_per_unit: e.target.value }))}
                        placeholder="0.5"
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                      <input value={form.bulk_unit} onChange={(e) => setForm((p) => ({ ...p, bulk_unit: e.target.value }))}
                        placeholder="kg"
                        className="w-12 rounded-lg border border-border bg-background px-1 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center leading-tight">granel por<br/>1 und. final</p>
                  </div>

                  {/* Mobile: cantidad inline */}
                  <div className="md:hidden space-y-1">
                    <label className="text-xs font-semibold text-foreground">Cantidad <span className="text-destructive">*</span></label>
                    <div className="flex gap-2">
                      <input type="number" required min="0.001" step="any" value={form.bulk_qty_per_unit}
                        onChange={(e) => setForm((p) => ({ ...p, bulk_qty_per_unit: e.target.value }))}
                        placeholder="0.5" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      <input value={form.bulk_unit} onChange={(e) => setForm((p) => ({ ...p, bulk_unit: e.target.value }))}
                        placeholder="kg" className="w-16 rounded-lg border border-border bg-background px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>

                  {/* Terminado */}
                  <div className="space-y-1">
                    <label className="flex flex-wrap items-center gap-1 text-xs font-semibold text-foreground">
                      <PackageCheck className="h-3 w-3 text-brand-600" />
                      Producto Terminado <span className="text-destructive">*</span>
                      <span className="font-normal text-[10px] text-muted-foreground w-full leading-none">Ingresa al stock al completar el empaque</span>
                    </label>
                    {outputProducts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10 px-3 py-2">
                        <p className="text-xs text-brand-700 dark:text-brand-400">Sin productos.{" "}
                          <Link href="/admin/products" target="_blank" className="underline">Crear →</Link>
                        </p>
                      </div>
                    ) : (
                      <select value={form.output_product_id}
                        onChange={(e) => setForm((p) => ({ ...p, output_product_id: e.target.value }))}
                        className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${noOutputSelected && form.finished_product_id ? "border-amber-400 dark:border-amber-600" : "border-brand-300 dark:border-brand-700"}`}>
                        <option value="">— Sin asignar —</option>
                        {outputProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.unit}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Advertencia */}
                {noOutputSelected && form.finished_product_id && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/15 px-3 py-2 flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
                      Sin producto de salida no generará stock vendible.{" "}
                      <Link href="/admin/products" target="_blank" className="font-semibold underline">Crear Producto Terminado →</Link>
                    </p>
                  </div>
                )}

                {/* Unidad + Descripción */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Unidad empacada <span className="text-destructive">*</span>
                      <span className="font-normal text-[10px] text-muted-foreground block mt-0.5">Ej: unidad, bolsa, tarrina, pote</span>
                    </label>
                    <input required value={form.output_unit}
                      onChange={(e) => setForm((p) => ({ ...p, output_unit: e.target.value }))}
                      placeholder="unidad, paquete..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Descripción
                      <span className="font-normal text-[10px] text-muted-foreground block mt-0.5">Observaciones internas (opcional)</span>
                    </label>
                    <input value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Notas opcionales..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Fórmula */}
                {selectedGranel && Number(form.bulk_qty_per_unit) > 0 && (
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted-foreground">Fórmula:</span>
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      {form.bulk_qty_per_unit} {form.bulk_unit} de {selectedGranel.name}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                      1 {form.output_unit} de {selectedOutput?.name ?? "producto terminado"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Columna derecha: Materiales ─── */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold shrink-0">2</span>
                  <div>
                    <h3 className="text-sm font-semibold">Materiales de Empaque</h3>
                    <p className="text-[10px] text-muted-foreground">Envases, tapas, etiquetas...</p>
                  </div>
                </div>
                <button type="button" onClick={addMaterial}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-2.5 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:bg-brand-100 transition-colors">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>

              <div className="p-4 space-y-2 flex-1">
                {packagingMaterials.length === 0 && (
                  <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      Crea productos tipo <strong>Envase/Empaque</strong> en{" "}
                      <Link href="/admin/products" target="_blank" className="underline">Productos →</Link>
                    </p>
                  </div>
                )}

                {/* Cabeceras de columna */}
                <div className="flex gap-2 px-2.5">
                  <span className="flex-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Material / SKU</span>
                  <span className="w-14 text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">Cant.</span>
                  <span className="w-12 text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">Und.</span>
                  <span className="w-7" />
                </div>
                {materials.map((mat, index) => {
                  const selectedMat = packagingMaterials.find((p) => p.id === mat.material_product_id);
                  return (
                    <div key={index} className="flex gap-2 items-center bg-muted/20 rounded-lg border border-border/60 p-2.5">
                      <div className="flex-1 min-w-0">
                        <select value={mat.material_product_id}
                          onChange={(e) => updateMaterial(index, "material_product_id", e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                          <option value="">Material {index + 1}...</option>
                          {packagingMaterials.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {selectedMat && (
                          <p className="text-[9px] text-muted-foreground font-mono mt-0.5 pl-0.5">SKU: {selectedMat.sku}</p>
                        )}
                      </div>
                      <input type="number" min="0.001" step="any" value={mat.quantity_per_unit}
                        onChange={(e) => updateMaterial(index, "quantity_per_unit", e.target.value)}
                        placeholder="1"
                        className="w-14 rounded-lg border border-border bg-background px-1.5 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring shrink-0" />
                      <span className="w-12 shrink-0 inline-flex items-center justify-center rounded-md bg-muted border border-border/60 px-1 py-1.5 text-xs font-mono text-muted-foreground select-none" title="Unidad del producto seleccionado">
                        {mat.unit || "—"}
                      </span>
                      <button type="button" onClick={() => removeMaterial(index)} disabled={materials.length === 1}
                        className="shrink-0 rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50 disabled:opacity-30 transition-colors"
                        aria-label="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving || !canSubmit}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Actualizar Plantilla"}
            </button>
            <Link href="/admin/packaging/templates"
              className="rounded-lg border border-border bg-background px-6 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
