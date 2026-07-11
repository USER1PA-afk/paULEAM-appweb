"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Factory, LogIn, ImageOff, Check, X as XIcon, Upload, Truck, Store as StoreIcon } from "lucide-react";
import { useAuth } from "@features/auth/hooks";
import { useCart } from "@features/checkout/hooks";
import { useActivePromotions } from "@features/promotions/hooks";
import { getCatalogPromoInfo } from "@features/promotions/lib/apply-promotions";
import { PromoBadge } from "@features/promotions/components";
import { useProductionRequests, uploadReceipt, type FulfillmentType } from "@features/production-requests/hooks";
import { formatCurrency } from "@shared/lib/utils";

export interface ProductDetailViewProps {
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    unit: string;
    capacity_unit: string | null;
    sales_unit_name: string | null;
    conversion_factor: number;
    image_url: string | null;
    short_description: string | null;
    description: string | null;
    long_description: string | null;
    ingredients: string | null;
    nutritional_info: Record<string, string> | null;
    specifications: Record<string, string> | null;
    commercial_details: string | null;
    featured: boolean;
    weight: number | null;
  };
  images: { id: string; public_url: string; alt_text: string | null; is_primary: boolean }[];
  stockAvailable: number;
}

function clampQty(value: string, max?: number): string {
  if (value === "") return "";
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.max(n, 1);
  if (max !== undefined) return String(Math.min(clamped, Math.max(max, 1)));
  return String(clamped);
}

export function ProductDetailView({ product, images, stockAvailable }: ProductDetailViewProps) {
  const { isAuthenticated, user } = useAuth();
  const { addItem, loading: cartLoading } = useCart(user?.id ?? null);
  const { data: activePromotions } = useActivePromotions();
  const { createRequest } = useProductionRequests();

  const allImages = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; alt: string }[] = [];
    if (product.image_url && !seen.has(product.image_url)) {
      seen.add(product.image_url);
      out.push({ url: product.image_url, alt: product.name });
    }
    for (const img of images) {
      if (!seen.has(img.public_url)) {
        seen.add(img.public_url);
        out.push({ url: img.public_url, alt: img.alt_text ?? product.name });
      }
    }
    return out;
  }, [images, product.image_url, product.name]);

  const [activeImage, setActiveImage] = useState<string | null>(allImages[0]?.url ?? null);
  const [qty, setQty] = useState<string>("1");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "auth"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const [showRequest, setShowRequest] = useState(false);
  const [requestQty, setRequestQty] = useState("1");
  const [requestFulfillment, setRequestFulfillment] = useState<FulfillmentType>("PICK-UP_IN_PLANT");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const promoInfo = getCatalogPromoInfo(product.id, Number(product.price), activePromotions ?? []);
  const finalPrice = promoInfo?.discountedPrice ?? Number(product.price);
  const cf = product.conversion_factor || 1;
  const availableUnits = Math.floor(stockAvailable / cf);
  const parsedQty = parseInt(qty, 10);
  const requestedUnits = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
  const exceedsStock = requestedUnits > availableUnits;
  const outOfStock = availableUnits <= 0;
  const unitLabel = product.sales_unit_name || product.capacity_unit || product.unit;

  async function handleAdd() {
    if (!isAuthenticated) {
      setFeedback({ type: "auth", text: "Inicia sesión para comprar." });
      return;
    }
    setAdding(true);
    setFeedback(null);
    const result = await addItem(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        price: product.price,
        image_url: product.image_url,
        conversion_factor: product.conversion_factor,
        sales_unit_name: product.sales_unit_name,
        capacity_unit: product.capacity_unit,
      },
      requestedUnits
    );
    setAdding(false);
    if (result.error) {
      setFeedback({ type: "error", text: result.error });
      return;
    }
    setFeedback({ type: "success", text: `${product.name} agregado al carrito` });
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestFile) return;
    setRequestSubmitting(true);
    setFeedback(null);

    const { path, error: uploadError } = await uploadReceipt(requestFile);
    if (uploadError || !path) {
      setFeedback({ type: "error", text: uploadError ?? "Error al subir comprobante" });
      setRequestSubmitting(false);
      return;
    }

    const q = parseFloat(requestQty);
    const total = product.price * (Number.isFinite(q) && q > 0 ? q : 1);
    const { error: createError } = await createRequest({
      product_id: product.id,
      quantity_requested: q,
      total_amount: total,
      receipt_path: path,
      fulfillment_type: requestFulfillment,
    });
    setRequestSubmitting(false);
    if (createError) {
      setFeedback({ type: "error", text: createError });
      return;
    }
    setShowRequest(false);
    setRequestFile(null);
    setRequestQty("1");
    setFeedback({ type: "success", text: "Solicitud enviada. Será revisada por personal autorizado." });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* ── Gallery ── */}
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-muted">
          {activeImage ? (
            <Image
              src={activeImage}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff aria-hidden="true" className="h-20 w-20 text-muted-foreground opacity-30" />
            </div>
          )}
          {product.featured && (
            <span className="absolute top-4 left-4 rounded-full bg-amber-500/95 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              ✦ Destacado
            </span>
          )}
          {promoInfo && (
            <div className="absolute top-4 right-4">
              <PromoBadge text={promoInfo.badgeText} type={promoInfo.type} />
            </div>
          )}
        </div>

        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="list">
            {allImages.map((img, i) => (
              <button
                key={`${img.url}-${i}`}
                type="button"
                role="listitem"
                onClick={() => setActiveImage(img.url)}
                aria-label={`Ver imagen ${i + 1}`}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  activeImage === img.url
                    ? "border-brand-600 ring-2 ring-brand-100"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <Image src={img.url} alt={img.alt} fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Info + actions ── */}
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            Planta de Alimentos ULEAM
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            {product.name}
          </h1>
          {product.short_description && (
            <p className="mt-3 text-base text-muted-foreground">{product.short_description}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              {promoInfo?.discountedPrice != null && (
                <p className="text-sm text-muted-foreground line-through tabular-nums">
                  {formatCurrency(Number(product.price))}
                </p>
              )}
              <p className="text-4xl font-extrabold tabular-nums text-foreground">
                {formatCurrency(finalPrice)}
                {unitLabel && (
                  <span className="ml-1 text-base font-normal text-muted-foreground">/ {unitLabel}</span>
                )}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                outOfStock
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : availableUnits <= 5
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              }`}
            >
              {outOfStock
                ? "Agotado temporalmente"
                : `Disponible: ${availableUnits} ${unitLabel ?? "unidades"}`}
            </span>
          </div>

          {feedback && (
            <div
              role="alert"
              aria-live="polite"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                  : feedback.type === "auth"
                  ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
              }`}
            >
              {feedback.type === "auth" ? (
                <span className="flex items-center gap-2">
                  {feedback.text}{" "}
                  <Link href="/login" className="underline font-semibold">
                    Ingresar →
                  </Link>
                </span>
              ) : (
                feedback.text
              )}
            </div>
          )}

          {isAuthenticated ? (
            outOfStock || exceedsStock ? (
              <button
                type="button"
                onClick={() => {
                  setRequestQty(String(requestedUnits));
                  setShowRequest(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
              >
                <Factory aria-hidden="true" className="h-4 w-4" />
                Solicitar producción bajo demanda
              </button>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="qty" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Cantidad
                  </label>
                  <input
                    id="qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(clampQty(e.target.value))}
                    className="w-24 rounded-lg border border-border bg-background px-3 py-2.5 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={cartLoading || adding}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? (
                    "Agregando..."
                  ) : (
                    <>
                      <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                      Agregar al carrito
                    </>
                  )}
                </button>
              </div>
            )
          ) : (
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
            >
              <LogIn aria-hidden="true" className="h-4 w-4" />
              Inicia sesión para comprar
            </Link>
          )}
        </div>

        {/* ── Long description ── */}
        {(product.long_description || product.description) && (
          <section aria-labelledby="long-desc">
            <h2 id="long-desc" className="text-lg font-bold text-foreground">
              Descripción
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {product.long_description || product.description}
            </p>
          </section>
        )}

        {/* ── Ingredients ── */}
        {product.ingredients && (
          <section aria-labelledby="ingredients">
            <h2 id="ingredients" className="text-lg font-bold text-foreground">
              Ingredientes y Alérgenos
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {product.ingredients}
            </p>
          </section>
        )}

        {/* ── Nutrition ── */}
        {product.nutritional_info && Object.keys(product.nutritional_info).length > 0 && (
          <section aria-labelledby="nutrition">
            <h2 id="nutrition" className="text-lg font-bold text-foreground">
              Información Nutricional
            </h2>
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Componente</th>
                    <th className="px-3 py-2 text-right">Por porción</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(product.nutritional_info).map(([k, v], i) => (
                    <tr key={k} className={i % 2 === 0 ? "bg-card" : "bg-muted/5"}>
                      <td className="px-3 py-2 font-medium text-foreground">{k}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground/90">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Specifications ── */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <section aria-labelledby="specs">
            <h2 id="specs" className="text-lg font-bold text-foreground">
              Ficha Técnica
            </h2>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(product.specifications).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-muted/10 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ── Commercial ── */}
        {product.commercial_details && (
          <section aria-labelledby="commercial">
            <h2 id="commercial" className="text-lg font-bold text-foreground">
              Detalles Comerciales
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {product.commercial_details}
            </p>
          </section>
        )}

        {/* ── SKU + Weight ── */}
        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            SKU: <span className="font-mono text-foreground">{product.sku}</span>
          </p>
          {product.weight != null && (
            <p>Peso: {product.weight} {product.unit}</p>
          )}
        </div>
      </div>

      {/* ── On-demand production modal ── */}
      {showRequest && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowRequest(false)}
        >
          <div
            className="flex flex-col w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground text-sm truncate pr-4">
                Solicitar producción bajo demanda
              </h2>
              <button
                type="button"
                onClick={() => setShowRequest(false)}
                aria-label="Cerrar"
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {(() => {
                const q = parseFloat(requestQty);
                const validQty = Number.isFinite(q) && q > 0 ? q : 1;
                const total = product.price * validQty;
                const advance = total * 0.5;
                return (
                  <>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                      <p className="font-medium">Stock insuficiente</p>
                      <p className="mt-1">
                        Puedes solicitar la producción de <strong>{validQty} {unitLabel}</strong> de{" "}
                        <strong>{product.name}</strong>. El stock actual no cubre tu pedido.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="rq" className="text-sm font-medium text-foreground">
                        Cantidad solicitada
                      </label>
                      <input
                        id="rq"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={requestQty}
                        onChange={(e) => setRequestQty(clampQty(e.target.value))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Método de entrega</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRequestFulfillment("PICK-UP_IN_PLANT")}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            requestFulfillment === "PICK-UP_IN_PLANT"
                              ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <StoreIcon aria-hidden="true" className="inline h-3.5 w-3.5 mr-1" />
                          Retiro en planta
                        </button>
                        <button
                          type="button"
                          onClick={() => setRequestFulfillment("SHIPPING")}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            requestFulfillment === "SHIPPING"
                              ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Truck aria-hidden="true" className="inline h-3.5 w-3.5 mr-1" />
                          Envío a domicilio
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total estimado</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Anticipo (50%)</span>
                        <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                          {formatCurrency(advance)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Comprobante de pago (anticipo)</label>
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-6 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
                  {requestFile ? (
                    <span className="text-sm font-medium text-foreground">{requestFile.name}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-foreground">Adjuntar imagen o PDF</span>
                      <span className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP · máx. 10 MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setRequestFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequest(false)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!requestFile || requestSubmitting}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {requestSubmitting ? "Enviando..." : (
                    <>
                      <Factory aria-hidden="true" className="h-4 w-4" />
                      Enviar solicitud
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating success indicator (small dot on bottom) */}
      {feedback?.type === "success" && (
        <div className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <Check className="h-4 w-4" />
          {feedback.text}
        </div>
      )}
    </div>
  );
}
