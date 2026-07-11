"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronLeft, ShoppingBag, Save, Eye, EyeOff, Sparkles,
  Info, FileText, Image as ImageIcon, FlaskConical, Briefcase,
} from "lucide-react";
import { useStoreProductMutations, useCategories } from "@features/store-products/hooks";
import { ProductPreview, KVEditor, type KVPair } from "@features/store-products/components";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pairsToRecord(pairs: KVPair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]));
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
const textareaCls = inputCls + " resize-none";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewStoreProductPage() {
  const router = useRouter();
  const { createProduct, saving, error, setError } = useStoreProductMutations();
  const { categories } = useCategories();

  // Basic
  const [name,       setName]       = useState("");
  const [sku,        setSku]        = useState("");
  const [unit,       setUnit]       = useState("unidades");
  const [price,      setPrice]      = useState("");
  const [weight,     setWeight]     = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive,   setIsActive]   = useState(true);
  const [featured,   setFeatured]   = useState(false);

  // Descriptions
  const [shortDesc,  setShortDesc]  = useState("");
  const [desc,       setDesc]       = useState("");
  const [longDesc,   setLongDesc]   = useState("");

  // Details
  const [specs,       setSpecs]      = useState<KVPair[]>([]);
  const [ingredients, setIngredients] = useState("");
  const [nutrition,   setNutrition]  = useState<KVPair[]>([]);

  // Commercial
  const [commercial, setCommercial] = useState("");

  // Validation
  const [touched, setTouched] = useState(false);
  const nameError  = touched && !name.trim()  ? "El nombre es requerido" : "";
  const skuError   = touched && !sku.trim()   ? "El SKU es requerido" : "";
  const priceError = touched && (price === "" || Number(price) < 0) ? "Precio inválido" : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !sku.trim() || price === "") return;

    const id = await createProduct({
      name:                name.trim(),
      sku:                 sku.trim().toUpperCase(),
      unit,
      price:               Number(price),
      weight:              weight ? Number(weight) : null,
      category_id:         categoryId || null,
      is_active:           isActive,
      featured,
      description:         desc || null,
      short_description:   shortDesc || null,
      long_description:    longDesc || null,
      specifications:      pairsToRecord(specs),
      ingredients:         ingredients || null,
      nutritional_info:    pairsToRecord(nutrition),
      commercial_details:  commercial || null,
    });

    if (id) router.push(`/admin/store/products/${id}?created=1`);
  }

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/store/products"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" />
          <Link href="/admin/store/products" className="hover:text-foreground transition-colors">
            Productos
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuevo</span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Producto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Completa la información básica. Podrás agregar imágenes después de guardar.
          </p>
        </div>
      </div>

      {/* ─── Layout: form | preview ─── */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Form column ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Error banner */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 1 · General */}
            <Section icon={Info} title="Información General" description="Datos básicos que identifican el producto.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Field label="Nombre del Producto" required>
                    <input
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(null); }}
                      placeholder="Ej: Queso Fresco Artesanal 500g"
                      className={inputCls + (nameError ? " border-destructive ring-1 ring-destructive" : "")}
                    />
                    {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
                  </Field>
                </div>
                <div>
                  <Field label="SKU" required>
                    <input
                      value={sku}
                      onChange={(e) => { setSku(e.target.value.toUpperCase()); setError(null); }}
                      placeholder="PT-001"
                      className={inputCls + (skuError ? " border-destructive ring-1 ring-destructive" : "")}
                    />
                    {skuError && <p className="text-xs text-destructive mt-1">{skuError}</p>}
                  </Field>
                </div>
                <div>
                  <Field label="Precio (USD)" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className={inputCls + " pl-7" + (priceError ? " border-destructive ring-1 ring-destructive" : "")}
                      />
                    </div>
                    {priceError && <p className="text-xs text-destructive mt-1">{priceError}</p>}
                  </Field>
                </div>
                <div>
                  <Field label="Unidad de Medida" required>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                      <option value="unidades">Unidades</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="gr">Gramos (gr)</option>
                      <option value="lt">Litros (lt)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </Field>
                </div>
                <div>
                  <Field label="Peso del producto (kg)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="0.50"
                      className={inputCls}
                    />
                  </Field>
                </div>
                {categories.length > 0 && (
                  <div>
                    <Field label="Categoría">
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                        <option value="">Sin categoría</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
              </div>

              {/* Status toggles */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      isActive ? "bg-brand-600" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      isActive ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {isActive ? <Eye className="h-3.5 w-3.5 text-brand-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      {isActive ? "Visible en tienda" : "Oculto en tienda"}
                    </p>
                    <p className="text-xs text-muted-foreground">Aparece en el catálogo público</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setFeatured((v) => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      featured ? "bg-amber-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      featured ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Sparkles className={`h-3.5 w-3.5 ${featured ? "text-amber-500" : "text-muted-foreground"}`} />
                      {featured ? "Producto destacado" : "Sin destacar"}
                    </p>
                    <p className="text-xs text-muted-foreground">Se resalta en el catálogo</p>
                  </div>
                </label>
              </div>
            </Section>

            {/* 2 · Descripción */}
            <Section icon={FileText} title="Descripción" description="Información que verán los clientes en la tienda.">
              <div className="space-y-4">
                <Field label="Descripción corta (aparece en tarjeta del catálogo)">
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={shortDesc}
                    onChange={(e) => setShortDesc(e.target.value)}
                    placeholder="Resumen en 1-2 oraciones que describe el producto..."
                    className={textareaCls}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{shortDesc.length}/200</p>
                </Field>
                <Field label="Descripción general">
                  <textarea
                    rows={3}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Descripción del producto para la tienda..."
                    className={textareaCls}
                  />
                </Field>
                <Field label="Descripción detallada (página de producto)">
                  <textarea
                    rows={5}
                    value={longDesc}
                    onChange={(e) => setLongDesc(e.target.value)}
                    placeholder="Descripción completa: proceso de elaboración, origen, beneficios..."
                    className={textareaCls}
                  />
                </Field>
              </div>
            </Section>

            {/* 3 · Imágenes — placeholder (available after save) */}
            <Section icon={ImageIcon} title="Imágenes" description="Guarda el producto primero para agregar imágenes.">
              <div className="flex items-center justify-center h-28 rounded-lg border-2 border-dashed border-border bg-muted/20">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Disponible después de guardar el producto.
                  </p>
                </div>
              </div>
            </Section>

            {/* 4 · Ficha Técnica */}
            <Section icon={FlaskConical} title="Ficha Técnica" description="Especificaciones, ingredientes y nutrición.">
              <div className="space-y-5">
                <KVEditor
                  label="Especificaciones"
                  description="Atributos del producto: sabor, textura, origen, conservación, etc."
                  pairs={specs}
                  onChange={setSpecs}
                  keyPlaceholder="Ej: Sabor"
                  valuePlaceholder="Ej: Dulce"
                />
                <Field label="Ingredientes">
                  <textarea
                    rows={3}
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    placeholder="Ej: Leche entera, sal, cuajo natural..."
                    className={textareaCls}
                  />
                </Field>
                <KVEditor
                  label="Información Nutricional (por 100g)"
                  description="Valores nutricionales por porción o 100g."
                  pairs={nutrition}
                  onChange={setNutrition}
                  keyPlaceholder="Ej: Proteínas"
                  valuePlaceholder="Ej: 12g"
                />
              </div>
            </Section>

            {/* 5 · Comercial */}
            <Section icon={Briefcase} title="Información Comercial" description="Notas internas y detalles para el equipo de ventas.">
              <Field label="Notas comerciales">
                <textarea
                  rows={4}
                  value={commercial}
                  onChange={(e) => setCommercial(e.target.value)}
                  placeholder="Presentaciones disponibles, clientes objetivo, canales de venta, descuentos, etc."
                  className={textareaCls}
                />
              </Field>
            </Section>

            {/* Save bar */}
            <div className="sticky bottom-0 z-10 -mx-5 px-5 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-4">
              <Link
                href="/admin/store/products"
                className="rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Guardar y continuar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Preview column (desktop only) ── */}
          <div className="hidden lg:block w-56 shrink-0 sticky top-24 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vista previa
            </p>
            <ProductPreview
              name={name}
              price={Number(price) || 0}
              imageUrl={null}
              unit={unit}
              isActive={isActive}
              featured={featured}
            />
            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Así aparece en el catálogo
              </p>
              {isActive ? (
                <p className="text-xs text-brand-600">✓ Visible para clientes</p>
              ) : (
                <p className="text-xs text-muted-foreground">✗ Oculto del catálogo</p>
              )}
              {featured && (
                <p className="text-xs text-amber-600">✦ Producto destacado</p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
