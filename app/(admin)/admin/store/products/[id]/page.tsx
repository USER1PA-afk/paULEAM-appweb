"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import {
  ChevronLeft, ShoppingBag, Pencil, Save, X as XIcon,
  Eye, EyeOff, Sparkles, Package, TrendingUp, Boxes,
  Info, FileText, Image as ImageIcon, FlaskConical, Briefcase,
  CheckCircle2, RotateCcw, Monitor, MonitorOff,
} from "lucide-react";
import {
  useStoreProductDetail,
  useStoreProductMutations,
  useCategories,
  type StoreProduct,
} from "@features/store-products/hooks";
import {
  ProductStatusBadge,
  StockBadge,
  ProductPreview,
  KVEditor,
  ImageManager,
  type KVPair,
} from "@features/store-products/components";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function pairsToRecord(pairs: KVPair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]));
}
function recordToPairs(obj: Record<string, string> | null | undefined): KVPair[] {
  return Object.entries(obj ?? {}).map(([key, value]) => ({ key, value }));
}

// ─── Section components ───────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  noPad,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-muted/30">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
const textareaCls = inputCls + " resize-none";

// ─── View-mode field display ─────────────────────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoreProductDetailPage() {
  const params       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const productId    = params.id;

  const justCreated = searchParams.get("created") === "1";

  const { product, images, stock, salesStats, loading, refetch } =
    useStoreProductDetail(productId);
  const { updateProduct, toggleActive, toggleFeatured, togglePosVisibility, saving, error, setError } =
    useStoreProductMutations();
  const { categories } = useCategories();

  const [editMode, setEditMode] = useState(justCreated);
  const [showCreatedBanner, setShowCreatedBanner] = useState(justCreated);
  const [activeImage, setActiveImage] = useState(0);

  // Form state
  const [name,           setName]           = useState("");
  const [sku,            setSku]            = useState("");
  const [price,          setPrice]          = useState("");
  const [capacityUnit,   setCapacityUnit]   = useState("");
  const [packagingWeight, setPackagingWeight] = useState<number | null>(null);
  const [categoryId,     setCategoryId]     = useState("");
  const [isActive,       setIsActive]       = useState(true);
  const [featured,       setFeatured]       = useState(false);
  const [shortDesc,   setShortDesc]   = useState("");
  const [desc,        setDesc]        = useState("");
  const [longDesc,    setLongDesc]    = useState("");
  const [specs,       setSpecs]       = useState<KVPair[]>([]);
  const [ingredients, setIngredients] = useState("");
  const [nutrition,   setNutrition]   = useState<KVPair[]>([]);
  const [commercial,  setCommercial]  = useState("");

  // Populate form when product loads
  useEffect(() => {
    if (!product) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(product.name);
    setSku(product.sku);
    setPrice(String(product.price || 0));
    setCapacityUnit(product.capacity_unit ?? "");
    setCategoryId(product.category_id ?? "");
    setIsActive(product.is_active);
    setFeatured(product.featured);
    setShortDesc(product.short_description ?? "");
    setDesc(product.description ?? "");
    setLongDesc(product.long_description ?? "");
    setSpecs(recordToPairs(product.specifications));
    setIngredients(product.ingredients ?? "");
    setNutrition(recordToPairs(product.nutritional_info));
    setCommercial(product.commercial_details ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [product]);

  // Fetch bulk_qty_per_unit from the packaging template linked to this product (as output)
  useEffect(() => {
    if (!productId) return;
    const db = getInsforge();
    db.database
      .from("packaging_templates")
      .select("bulk_qty_per_unit")
      .eq("output_product_id", productId)
      .eq("is_active", true)
      .limit(1)
      .then(({ data }) => {
        const first = (data as { bulk_qty_per_unit: number }[] | null)?.[0];
        setPackagingWeight(first ? Number(first.bulk_qty_per_unit) : null);
      }, () => {});
  }, [productId]);

  function cancelEdit() {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setPrice(String(product.price || 0));
      setCapacityUnit(product.capacity_unit ?? "");
      setCategoryId(product.category_id ?? "");
      setIsActive(product.is_active);
      setFeatured(product.featured);
      setShortDesc(product.short_description ?? "");
      setDesc(product.description ?? "");
      setLongDesc(product.long_description ?? "");
      setSpecs(recordToPairs(product.specifications));
      setIngredients(product.ingredients ?? "");
      setNutrition(recordToPairs(product.nutritional_info));
      setCommercial(product.commercial_details ?? "");
    }
    setEditMode(false);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    const ok = await updateProduct(productId, {
      name:               name.trim(),
      sku:                sku.trim().toUpperCase(),
      unit:               "unidades",
      price:              Number(price),
      capacity_unit:      capacityUnit || null,
      weight:             packagingWeight,
      category_id:        categoryId || null,
      is_active:          isActive,
      featured,
      description:        desc || null,
      short_description:  shortDesc || null,
      long_description:   longDesc || null,
      specifications:     pairsToRecord(specs),
      ingredients:        ingredients || null,
      nutritional_info:   pairsToRecord(nutrition),
      commercial_details: commercial || null,
    } as Partial<StoreProduct>);

    if (ok) {
      await refetch();
      setEditMode(false);
    }
  }

  async function handleToggleActive() {
    if (!product) return;
    await toggleActive(productId, product.is_active);
    await refetch();
  }

  async function handleToggleFeatured() {
    if (!product) return;
    await toggleFeatured(productId, product.featured);
    await refetch();
  }

  async function handleTogglePos() {
    if (!product) return;
    await togglePosVisibility(productId, product.show_in_pos !== false);
    await refetch();
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24 space-y-3">
        <Package className="h-12 w-12 mx-auto text-muted-foreground/20" />
        <p className="text-muted-foreground">Producto no encontrado.</p>
        <Link href="/admin/store/products" className="text-sm text-brand-600 hover:underline">
          ← Volver al listado
        </Link>
      </div>
    );
  }

  const displayImages = images.length > 0 ? images : [];

  // ─── Render ───
  return (
    <div className="space-y-5 max-w-6xl">

      {/* ─── Breadcrumb + actions ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
            <span className="text-foreground font-medium truncate max-w-40">{product.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status actions */}
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              product.is_active
                ? "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                : "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-400"
            }`}
          >
            {product.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {product.is_active ? "Ocultar" : "Publicar"}
          </button>
          <button
            onClick={handleToggleFeatured}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              product.featured
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {product.featured ? "Quitar destacado" : "Destacar"}
          </button>
          <button
            onClick={handleTogglePos}
            title={product.show_in_pos !== false ? "Visible en POS — clic para ocultar" : "Oculto en POS — clic para mostrar"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              product.show_in_pos !== false
                ? "border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:border-teal-700 dark:text-teal-400"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {product.show_in_pos !== false
              ? <Monitor className="h-3.5 w-3.5" />
              : <MonitorOff className="h-3.5 w-3.5" />}
            {product.show_in_pos !== false ? "En POS" : "Oculto en POS"}
          </button>

          {/* Edit toggle */}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <XIcon className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ─── Just created banner ─── */}
      {showCreatedBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">
              ¡Producto creado exitosamente!
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
              Ahora puedes agregar imágenes usando el gestor de abajo, y editar cualquier campo.
            </p>
          </div>
          <button onClick={() => setShowCreatedBanner(false)} className="text-brand-500 hover:text-brand-700 transition-colors">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Main layout ─── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left/main column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {editMode ? (
            /* ════════════════════════ EDIT FORM ════════════════════════ */
            <form onSubmit={handleSave} noValidate className="space-y-4">

              {/* General */}
              <Section icon={Info} title="Información General">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <Field label="Nombre *">
                      <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
                    </Field>
                  </div>
                  <Field label="SKU *">
                    <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} required className={inputCls} />
                  </Field>
                  <Field label="Precio (USD) *">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls + " pl-7"} />
                    </div>
                  </Field>
                  <Field label="Unidad de inventario">
                    <div className={inputCls + " bg-muted cursor-not-allowed text-muted-foreground select-none"}>
                      Unidades
                    </div>
                  </Field>
                  <Field label="Unidad de venta pública">
                    <select value={capacityUnit} onChange={(e) => setCapacityUnit(e.target.value)} className={inputCls}>
                      <option value="">— sin especificar —</option>
                      <optgroup label="Masa">
                        <option value="lb">Libras (lb)</option>
                        <option value="kg">Kilogramos (kg)</option>
                        <option value="g">Gramos (g)</option>
                        <option value="oz">Onzas (oz)</option>
                      </optgroup>
                      <optgroup label="Volumen">
                        <option value="lt">Litros (lt)</option>
                        <option value="ml">Mililitros (ml)</option>
                      </optgroup>
                      <optgroup label="Otro">
                        <option value="unidad">Unidad</option>
                        <option value="paquete">Paquete</option>
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">Se muestra como &ldquo;$Precio / unidad&rdquo; en la tienda y el POS. Si define una unidad de venta (ej: Libra), se usará esa en su lugar.</p>
                  </Field>
                  <Field label="Peso (kg)">
                    <div className={inputCls + " bg-muted cursor-not-allowed flex items-center gap-2"}>
                      {packagingWeight !== null ? (
                        <>
                          <span className="font-mono tabular-nums">{packagingWeight}</span>
                          <span className="text-[10px] text-muted-foreground">kg · desde plantilla de empaque</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin plantilla de empaque vinculada</span>
                      )}
                    </div>
                  </Field>
                  {categories.length > 0 && (
                    <Field label="Categoría">
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                        <option value="">Sin categoría</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setIsActive((v) => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? "bg-brand-600" : "bg-muted-foreground/30"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm font-medium">{isActive ? <><Eye className="h-3.5 w-3.5 inline text-brand-600 mr-1" />Visible</> : <><EyeOff className="h-3.5 w-3.5 inline mr-1" />Oculto</>}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setFeatured((v) => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${featured ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${featured ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm font-medium"><Sparkles className={`h-3.5 w-3.5 inline mr-1 ${featured ? "text-amber-500" : ""}`} />{featured ? "Destacado" : "Sin destacar"}</span>
                  </label>
                </div>
              </Section>

              {/* Descriptions */}
              <Section icon={FileText} title="Descripción">
                <div className="space-y-4">
                  <Field label="Descripción corta (tarjeta del catálogo)">
                    <textarea rows={2} maxLength={200} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className={textareaCls} />
                    <p className="text-[11px] text-right text-muted-foreground">{shortDesc.length}/200</p>
                  </Field>
                  <Field label="Descripción general">
                    <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={textareaCls} />
                  </Field>
                  <Field label="Descripción detallada">
                    <textarea rows={5} value={longDesc} onChange={(e) => setLongDesc(e.target.value)} className={textareaCls} />
                  </Field>
                </div>
              </Section>

              {/* Images */}
              <Section icon={ImageIcon} title="Imágenes">
                <div className="p-5">
                  <ImageManager
                    productId={productId}
                    onPrimaryChange={() => refetch()}
                  />
                </div>
              </Section>

              {/* Technical */}
              <Section icon={FlaskConical} title="Ficha Técnica">
                <div className="space-y-5">
                  <KVEditor label="Especificaciones" pairs={specs} onChange={setSpecs} keyPlaceholder="Atributo" valuePlaceholder="Valor" />
                  <Field label="Ingredientes">
                    <textarea rows={3} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className={textareaCls} />
                  </Field>
                  <KVEditor label="Información Nutricional (por 100g)" pairs={nutrition} onChange={setNutrition} keyPlaceholder="Nutriente" valuePlaceholder="Cantidad" />
                </div>
              </Section>

              {/* Commercial */}
              <Section icon={Briefcase} title="Información Comercial">
                <Field label="Notas comerciales">
                  <textarea rows={4} value={commercial} onChange={(e) => setCommercial(e.target.value)} className={textareaCls} />
                </Field>
              </Section>

              {/* Save bar */}
              <div className="sticky bottom-0 z-10 -mx-0 px-0 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Descartar cambios
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Guardando...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Guardar cambios</>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ════════════════════════ VIEW MODE ════════════════════════ */
            <div className="space-y-4">

              {/* Header card */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-5 p-5">
                  {/* Image gallery */}
                  <div className="shrink-0 space-y-2">
                    <div className="relative h-40 w-40 rounded-xl overflow-hidden bg-muted border border-border">
                      {displayImages.length > 0 ? (
                        <Image
                          src={displayImages[activeImage]?.public_url ?? ""}
                          alt={product.name}
                          fill
                          sizes="160px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : product.image_url ? (
                        <Image src={product.image_url} alt={product.name} fill sizes="160px" className="object-cover" unoptimized />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-14 w-14 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                    {displayImages.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap w-40">
                        {displayImages.map((img, idx) => (
                          <button
                            key={img.id}
                            onClick={() => setActiveImage(idx)}
                            className={`relative h-9 w-9 rounded-md overflow-hidden border-2 transition-colors ${
                              activeImage === idx ? "border-brand-500" : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <Image src={img.public_url} alt="" fill sizes="36px" className="object-cover" unoptimized />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <ProductStatusBadge isActive={product.is_active} featured={product.featured} stock={stock} />
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {product.sku}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold">{product.name}</h2>
                      {product.short_description && (
                        <p className="text-sm text-muted-foreground mt-1">{product.short_description}</p>
                      )}
                    </div>

                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-brand-600">{fmt(product.price || 0)}</span>
                      <span className="text-sm text-muted-foreground mb-1">/ {product.sales_unit_name || product.capacity_unit || product.unit}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <Boxes className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Stock</p>
                        <StockBadge stock={stock} unit={product.unit} />
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Órdenes</p>
                        <p className="text-sm font-bold">{salesStats.totalOrders}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Unidades vendidas</p>
                        <p className="text-sm font-bold tabular-nums">
                          {salesStats.totalUnits % 1 === 0
                            ? salesStats.totalUnits.toFixed(0)
                            : salesStats.totalUnits.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <TrendingUp className="h-4 w-4 mx-auto text-brand-600 mb-1" />
                        <p className="text-xs text-muted-foreground">Ingresos</p>
                        <p className="text-sm font-bold text-brand-600 tabular-nums">{fmt(salesStats.totalRevenue)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Descriptions */}
              {(product.description || product.long_description) && (
                <Section icon={FileText} title="Descripción">
                  <div className="p-5 space-y-4">
                    {product.description && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Descripción General</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{product.description}</p>
                      </div>
                    )}
                    {product.long_description && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Descripción Detallada</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{product.long_description}</p>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Images gallery (manage) */}
              <Section icon={ImageIcon} title={`Imágenes (${displayImages.length})`}>
                <div className="p-5">
                  {displayImages.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">Sin imágenes. Añade la imagen del producto.</p>
                      <button
                        onClick={() => setEditMode(true)}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                      >
                        Agregar imágenes
                      </button>
                    </div>
                  ) : (
                    <ImageManager productId={productId} onPrimaryChange={() => refetch()} />
                  )}
                </div>
              </Section>

              {/* Technical sheet */}
              {(Object.keys(product.specifications ?? {}).length > 0 ||
                product.ingredients ||
                Object.keys(product.nutritional_info ?? {}).length > 0) && (
                <Section icon={FlaskConical} title="Ficha Técnica">
                  <div className="p-5 space-y-5">
                    {Object.keys(product.specifications ?? {}).length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Especificaciones</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {Object.entries(product.specifications).map(([k, v]) => (
                            <div key={k} className="flex gap-2 items-start rounded-md bg-muted/30 px-3 py-2">
                              <span className="text-xs text-muted-foreground min-w-0 flex-1">{k}</span>
                              <span className="text-xs font-medium text-foreground">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.ingredients && (
                      <ViewField label="Ingredientes" value={product.ingredients} />
                    )}
                    {Object.keys(product.nutritional_info ?? {}).length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Información Nutricional (por 100g)</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {Object.entries(product.nutritional_info).map(([k, v]) => (
                            <div key={k} className="flex gap-2 items-start rounded-md bg-muted/30 px-3 py-2">
                              <span className="text-xs text-muted-foreground min-w-0 flex-1">{k}</span>
                              <span className="text-xs font-medium text-foreground">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Commercial + metadata */}
              <Section icon={Info} title="Detalles del Producto">
                <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ViewField label="SKU" value={product.sku} />
                  <ViewField label="Unidad" value={product.unit} />
                  {product.weight && <ViewField label="Peso" value={`${product.weight} kg`} />}
                  <ViewField label="Precio" value={fmt(product.price || 0)} />
                  <ViewField label="Creado" value={fmtDate(product.created_at)} />
                  <ViewField label="Actualizado" value={fmtDate(product.updated_at)} />
                  {product.commercial_details && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <ViewField label="Notas Comerciales" value={product.commercial_details} />
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* ── Right sidebar — preview (desktop, view mode only) ── */}
        {!editMode && (
          <div className="hidden xl:block w-56 shrink-0 sticky top-24 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vista en tienda
            </p>
            <ProductPreview
              name={product.name}
              price={product.price || 0}
              imageUrl={product.image_url}
              unit={product.unit}
              isActive={product.is_active}
              featured={product.featured}
              stock={stock}
            />
            <Link
              href="/shop/catalog"
              target="_blank"
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver en catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
