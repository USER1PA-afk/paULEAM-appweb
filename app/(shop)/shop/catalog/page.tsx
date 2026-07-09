"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useCart } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useActivePromotions } from "@features/promotions/hooks";
import { getCatalogPromoInfo } from "@features/promotions/lib/apply-promotions";
import { PromoBadge } from "@features/promotions/components";
import { useState, useEffect, useCallback } from "react";
import { Leaf, ImageOff, ShoppingCart as CartIcon, LogIn, X as XIcon, Upload, Factory } from "lucide-react";
import { useProductionRequests, uploadReceipt, type FulfillmentType } from "@features/production-requests/hooks";
import Image from "next/image";
import Link from "next/link";

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  short_description: string | null;
  long_description: string | null;
  specifications: Record<string, string> | null;
  ingredients: string | null;
  nutritional_info: Record<string, string> | null;
  weight: number | null;
  commercial_details: string | null;
  price: number;
  unit: string;
  capacity_unit: string | null;
  image_url: string | null;
  is_active: boolean;
  featured: boolean;
  conversion_factor: number;
  sales_unit_name: string | null;
  stock_actual: number;
  stock_available: number;
}

/**
 * Normaliza el valor del input de cantidad: permite cadena vacía mientras se
 * edita y exige mínimo 1. El tope superior es opcional (para modo carrito).
 */
function clampQty(value: string, max?: number): string {
  if (value === "") return "";
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.max(n, 1);
  if (max !== undefined) return String(Math.min(clamped, Math.max(max, 1)));
  return String(clamped);
}

interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  public_url: string;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, user } = useAuth();
  const { addItem, loading: cartLoading } = useCart(user?.id ?? null);
  const { data: activePromotions } = useActivePromotions();
  const [addingId, setAddingId] = useState<string | null>(null);
  // Store raw string so the user can clear the field and type freely.
  // Empty string is valid; handleAddToCart defaults it to 1.
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "auth" } | null>(null);
  const [requestProduct, setRequestProduct] = useState<CatalogProduct | null>(null);
  const [requestQty, setRequestQty] = useState<string>("1");
  const [requestFulfillment, setRequestFulfillment] = useState<FulfillmentType>("PICK-UP_IN_PLANT");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const { createRequest } = useProductionRequests();
  // In-modal feedback (rendered inside the modal, not behind the backdrop).
  const [modalFeedback, setModalFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const insforge = getInsforge();

  // Modal State
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"descripcion" | "ingredientes" | "nutricion" | "especificaciones" | "comercial">("descripcion");

  const fetchProducts = useCallback(async () => {
    // packaging_templates requires auth in RLS — only query when authenticated.
    // Unauthenticated users see all PRODUCTO_TERMINADO items (acceptable for browsing).
    let bulkInputIds = new Set<string>();
    if (isAuthenticated) {
      const { data: tplData } = await insforge.database
        .from("packaging_templates")
        .select("finished_product_id")
        .eq("is_active", true);
      bulkInputIds = new Set<string>(
        (tplData as { finished_product_id: string }[] ?? []).map((t) => t.finished_product_id)
      );
    }

    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, description, short_description, long_description, price, unit, capacity_unit, image_url, is_active, featured, weight, ingredients, specifications, nutritional_info, commercial_details, conversion_factor, sales_unit_name")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0)
      .order("name");

    // Stock disponible por producto (balance menos reservas activas) para
    // poder limitar el desplegable de cantidad a las unidades reservables.
    const { data: stockData } = await insforge.database
      .from("stock_summary")
      .select("product_id, stock_actual, stock_available");
    const stockMap = new Map<string, { actual: number; available: number }>(
      ((stockData as { product_id: string; stock_actual: number | string; stock_available: number | string }[]) ?? [])
        .map((s) => [s.product_id, { actual: Number(s.stock_actual), available: Number(s.stock_available) }])
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedProducts = ((data as any[]) ?? [])
      // Excluir productos granel (inputs de plantillas de empaque)
      .filter((p) => !bulkInputIds.has(p.id))
      .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      short_description: p.short_description,
      long_description: p.long_description,
      specifications: p.specifications,
      ingredients: p.ingredients,
      nutritional_info: p.nutritional_info,
      weight: p.weight,
      commercial_details: p.commercial_details,
      price: Number(p.price),
      unit: p.unit,
      capacity_unit: p.capacity_unit ?? null,
      image_url: p.image_url,
      is_active: p.is_active,
      featured: p.featured,
      conversion_factor: Number(p.conversion_factor ?? 1.0),
      sales_unit_name: p.sales_unit_name,
      stock_actual: stockMap.get(p.id)?.actual ?? 0,
      stock_available: stockMap.get(p.id)?.available ?? 0,
    }));

    setProducts(mappedProducts);
    setLoading(false);
  }, [insforge, isAuthenticated]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Fetch extra details when product is selected
  useEffect(() => {
    if (!selectedProduct) {
      setProductImages([]);
      setAvailableStock(null);
      setActiveImageUrl(null);
      return;
    }

    const fetchExtraDetails = async () => {
      try {
        // Fetch images
        const { data: imgs } = await insforge.database
          .from("product_images")
          .select("*")
          .eq("product_id", selectedProduct.id)
          .order("position");
        
        const mappedImgs = ((imgs as Omit<ProductImage, "public_url">[]) ?? []).map((img) => ({
          ...img,
          public_url: insforge.storage.from("product-images").getPublicUrl(img.storage_path),
        }));

        setProductImages(mappedImgs);
        setActiveImageUrl(selectedProduct.image_url);

        // Fetch stock — use stock_available (balance minus active reservations)
        // so the customer sees the real reservable amount, not the total balance.
        const { data: stockRow } = await insforge.database
          .from("stock_summary")
          .select("stock_available")
          .eq("product_id", selectedProduct.id)
          .single();
        
        if (stockRow) {
          setAvailableStock(Number(stockRow.stock_available));
        } else {
          setAvailableStock(0);
        }
      } catch (err) {
        console.error("Error fetching extra details", err);
      }
    };

    fetchExtraDetails();
    setActiveTab("descripcion");
  }, [selectedProduct, insforge]);

  // Handle escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedProduct(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset modal feedback whenever the modal closes or the product changes.
  useEffect(() => {
    if (!selectedProduct) setModalFeedback(null);
  }, [selectedProduct]);

  // Quantity input change — accept empty string so the user can clear the
  // default and type freely. type="number" already rejects letters and most
  // symbols; we just store the raw string and validate on submit.
  const handleQuantityChange = useCallback((productId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  }, []);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestProduct || !requestFile) return;

    setRequestSubmitting(true);
    setMessage(null);

    const { path, error: uploadError } = await uploadReceipt(requestFile);
    if (uploadError || !path) {
      setMessage({ text: uploadError ?? "Error al subir comprobante", type: "error" });
      setRequestSubmitting(false);
      return;
    }

    const qty = parseFloat(requestQty);
    const total = requestProduct.price * qty;

    const { error: createError } = await createRequest({
      product_id: requestProduct.id,
      quantity_requested: qty,
      total_amount: total,
      receipt_path: path,
      fulfillment_type: requestFulfillment,
    });

    setRequestSubmitting(false);

    if (createError) {
      setMessage({ text: createError, type: "error" });
      return;
    }

    setRequestProduct(null);
    setRequestFile(null);
    setRequestQty("1");
    setMessage({ text: "Mensaje enviado. Su solicitud será revisada por personal autorizado.", type: "success" });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleAddToCart(product: CatalogProduct) {
    // Parse the raw string. Empty / 0 / NaN → silently default to 1.
    const raw = quantities[product.id] ?? "";
    const parsed = parseFloat(raw);
    const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

    const fromModal = selectedProduct?.id === product.id;

    // Verificar autenticación antes de intentar agregar
    if (!isAuthenticated) {
      if (fromModal) {
        setModalFeedback({ text: "Debes iniciar sesión para agregar productos al carrito.", type: "error" });
      } else {
        setMessage({ text: "Debes iniciar sesión para agregar productos al carrito.", type: "auth" });
        setTimeout(() => setMessage(null), 4000);
      }
      return;
    }

    setAddingId(product.id);
    setMessage(null);
    setModalFeedback(null);

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
      qty
    );

    setAddingId(null);

    if (result.error) {
      // Error — keep modal open so the user can fix the quantity and retry.
      if (fromModal) {
        setModalFeedback({ text: result.error, type: "error" });
      } else {
        setMessage({ text: result.error, type: "error" });
        setTimeout(() => setMessage(null), 3000);
      }
      return;
    }

    // Success
    if (fromModal) {
      setModalFeedback({ text: `${product.name} agregado al carrito`, type: "success" });
      // Auto-close after a brief moment so the user sees the success feedback.
      // Guarded by product.id so a quick switch to a different modal doesn't
      // get nuked by the previous add's timeout.
      setTimeout(() => {
        setSelectedProduct((current) => (current?.id === product.id ? null : current));
        setModalFeedback(null);
      }, 1200);
    } else {
      setMessage({ text: `${product.name} agregado al carrito`, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="space-y-1.5 mb-5 sm:space-y-2 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Catálogo de Productos
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Productos terminados en la Planta de Alimentos-Uleam disponibles para la compra.
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-6 right-6 z-50 max-w-xs rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            message.type === "auth"
              ? "bg-amber-600 text-white"
              : message.type === "error"
              ? "bg-destructive text-white"
              : "bg-brand-600 text-white"
          }`}
        >
          {message.type === "auth" ? (
            <span className="flex items-center gap-2">
              {message.text}{" "}
              <Link href="/login" className="underline font-semibold whitespace-nowrap">
                Ingresar →
              </Link>
            </span>
          ) : (
            message.text
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            role="status"
            className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
          >
            <span className="sr-only">Cargando productos...</span>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-24 text-muted-foreground">
          <Leaf aria-hidden="true" className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Próximamente</p>
          <p className="text-sm mt-1">No hay productos disponibles en este momento.</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product, idx) => {
            const promoInfo = getCatalogPromoInfo(product.id, Number(product.price), activePromotions ?? []);
            return (
            <div
              key={product.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5"
            >
              {/* Clickable image & details area */}
              <div
                onClick={() => setSelectedProduct(product)}
                className="cursor-pointer flex flex-col flex-1"
              >
                {/* Image */}
                <div className="relative aspect-square bg-linear-to-br from-brand-50 to-muted flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      priority={idx === 0}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ImageOff aria-hidden="true" className="h-12 w-12 opacity-20" />
                    </div>
                  )}
                  {product.featured && (
                    <div className="absolute top-3 left-3">
                      <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        ✦ Destacado
                      </span>
                    </div>
                  )}
                  {promoInfo && (
                    <div className="absolute top-3 right-3">
                      <PromoBadge text={promoInfo.badgeText} type={promoInfo.type} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-3 pb-0 sm:p-4">
                  <h3 className="font-semibold text-foreground leading-tight text-sm sm:text-base line-clamp-2">
                    {product.name}
                  </h3>
                  {(product.short_description || product.description) && (
                    <p className="mt-1 hidden text-xs text-muted-foreground line-clamp-2 sm:block">
                      {product.short_description || product.description}
                    </p>
                  )}
                  <div className="mt-auto pt-3 sm:pt-4">
                    {promoInfo?.discountedPrice != null && (
                      <p className="text-xs text-muted-foreground line-through tabular-nums">
                        {Number(product.price).toLocaleString("es-EC", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    )}
                    <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">
                      {Number(promoInfo?.discountedPrice ?? product.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                      {(product.sales_unit_name || product.capacity_unit || product.unit) && (
                        <span className="text-xs font-normal text-muted-foreground ml-1 sm:text-sm">/ {product.sales_unit_name || product.capacity_unit || product.unit}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Area (Not opening modal) */}
              <div className="p-3 pt-2 flex flex-col gap-2 sm:p-4 sm:pt-3">
                {isAuthenticated ? (() => {
                  const cf = product.conversion_factor || 1;
                  const availableUnits = Math.floor(product.stock_available / cf);
                  const rawQty = quantities[product.id] ?? "1";
                  const parsedQty = parseInt(rawQty, 10);
                  const requestedUnits = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
                  const exceedsStock = requestedUnits > availableUnits;

                  return (
                    <>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={rawQty}
                          onChange={(e) => handleQuantityChange(product.id, clampQty(e.target.value))}
                          aria-label={`Cantidad de ${product.name}`}
                          className="w-14 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {availableUnits <= 0 || exceedsStock ? (
                          <button
                            onClick={() => { setRequestProduct(product); setRequestQty(String(requestedUnits)); setRequestFulfillment("PICK-UP_IN_PLANT"); setRequestFile(null); }}
                            className="flex-1 min-w-0 rounded-lg bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-all text-center cursor-pointer sm:px-3"
                          >
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <Factory aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              Solicitar producción
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={cartLoading || addingId === product.id}
                            className="flex-1 min-w-0 rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center cursor-pointer sm:px-3"
                          >
                            {addingId === product.id ? (
                              "..."
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5">
                                <CartIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                Agregar
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {availableUnits <= 0
                          ? "Sin stock disponible"
                          : `+${availableUnits} disponible${availableUnits !== 1 ? "s" : ""}`}
                        {exceedsStock && availableUnits > 0 && (
                          <span className="ml-1 text-amber-600">· Solicita {requestedUnits - availableUnits} extra</span>
                        )}
                      </p>
                    </>
                  );
                })() : (
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-2 py-1.5 text-center text-[11px] leading-tight font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors sm:px-3 sm:text-xs"
                  >
                    <LogIn aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Inicia sesión para comprar
                  </Link>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setSelectedProduct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex flex-col w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Sticky close bar — always visible ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground text-sm truncate pr-4">
                {selectedProduct.name}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* ── Scrollable content ── */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 flex flex-col md:flex-row gap-6 md:gap-8">

            {/* Left Side: Images */}
            <div className="w-full md:w-1/2 flex flex-col gap-4">
              <div className="relative h-52 sm:h-72 md:aspect-square md:h-auto w-full rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center shadow-inner">
                {activeImageUrl ? (
                  <Image
                    src={activeImageUrl}
                    alt={selectedProduct.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageOff className="h-20 w-20 opacity-20" />
                  </div>
                )}
                {selectedProduct.featured && (
                  <div className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Destacado
                  </div>
                )}
              </div>

              {/* Thumbnails (Only show if multiple images available) */}
              {(productImages.length > 0 || selectedProduct.image_url) && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {selectedProduct.image_url && (
                    <button
                      onClick={() => setActiveImageUrl(selectedProduct.image_url)}
                      className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        activeImageUrl === selectedProduct.image_url
                          ? "border-brand-600 ring-2 ring-brand-100"
                          : "border-border hover:border-muted-foreground/60"
                      }`}
                    >
                      <Image
                        src={selectedProduct.image_url}
                        alt="Imagen principal"
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  )}
                  {productImages
                    .filter((img) => img.public_url !== selectedProduct.image_url)
                    .map((img) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImageUrl(img.public_url)}
                        className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          activeImageUrl === img.public_url
                            ? "border-brand-600 ring-2 ring-brand-100"
                            : "border-border hover:border-muted-foreground/60"
                        }`}
                      >
                        <Image
                          src={img.public_url}
                          alt={img.alt_text || "Imagen adicional"}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Right Side: Details */}
            <div className="w-full md:w-1/2 flex flex-col gap-5 justify-between">

              {/* Price & Cart Actions */}
              <div className="rounded-xl bg-muted/30 p-4 border border-border space-y-4">
                {(() => {
                  const modalPromo = getCatalogPromoInfo(selectedProduct.id, Number(selectedProduct.price), activePromotions ?? []);
                  return (
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div>
                    {modalPromo && (
                      <div className="mb-1 flex items-center gap-2">
                        <PromoBadge text={modalPromo.badgeText} type={modalPromo.type} />
                        {modalPromo.discountedPrice != null && (
                          <span className="text-sm text-muted-foreground line-through tabular-nums">
                            {Number(selectedProduct.price).toLocaleString("es-EC", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-3xl font-extrabold text-foreground tabular-nums">
                      {Number(modalPromo?.discountedPrice ?? selectedProduct.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                      {(selectedProduct.sales_unit_name || selectedProduct.capacity_unit || selectedProduct.unit) && (
                        <span className="text-base font-normal text-muted-foreground ml-1">/ {selectedProduct.sales_unit_name || selectedProduct.capacity_unit || selectedProduct.unit}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    {availableStock !== null ? (() => {
                      const cf = selectedProduct.conversion_factor || 1;
                      const units = Math.floor(availableStock / cf);
                      const unitLabel = selectedProduct.sales_unit_name || "unidades";
                      return (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          units <= 0
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : units <= 5
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {units <= 0 ? "Agotado temporalmente" : `Disponible: ${units} ${unitLabel}`}
                        </span>
                      );
                    })() : (
                      <span className="text-xs text-muted-foreground animate-pulse">Consultando stock...</span>
                    )}
                  </div>
                </div>
                  );
                })()}

                {isAuthenticated ? (
                  <div className="flex flex-col gap-3">
                    {modalFeedback && (
                      <div
                        role="alert"
                        aria-live="polite"
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${
                          modalFeedback.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                        }`}
                      >
                        {modalFeedback.text}
                      </div>
                    )}
                    {(() => {
                      const cf = selectedProduct.conversion_factor || 1;
                      const availUnits = availableStock !== null ? Math.floor(availableStock / cf) : 0;
                      const rawQty = quantities[selectedProduct.id] ?? "1";
                      const parsedQty = parseInt(rawQty, 10);
                      const requestedUnits = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
                      const exceedsStock = requestedUnits > availUnits;

                      return (
                        <div className="flex items-end gap-3">
                          <div className="flex flex-col gap-1">
                            <label htmlFor="modal-qty" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cantidad</label>
                            <input
                              id="modal-qty"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              value={rawQty}
                              onChange={(e) => handleQuantityChange(selectedProduct.id, clampQty(e.target.value))}
                              aria-label="Cantidad"
                              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          {exceedsStock || availUnits <= 0 ? (
                            <button
                              onClick={() => { setRequestProduct(selectedProduct); setRequestQty(String(requestedUnits)); setRequestFulfillment("PICK-UP_IN_PLANT"); setRequestFile(null); }}
                              className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Factory aria-hidden="true" className="h-4 w-4" />
                              Solicitar producción bajo demanda
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(selectedProduct)}
                              disabled={cartLoading || addingId === selectedProduct.id}
                              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {addingId === selectedProduct.id ? (
                                "Agregando..."
                              ) : (
                                <>
                                  <CartIcon aria-hidden="true" className="h-4 w-4" />
                                  Agregar al carrito
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    <LogIn aria-hidden="true" className="h-4 w-4" />
                    Inicia sesión para comprar
                  </Link>
                )}
              </div>

              {/* Tabs Information */}
              <div className="flex flex-col flex-1 min-h-[220px]">
                <div className="flex border-b border-border text-xs font-semibold overflow-x-auto pb-px scrollbar-none gap-2">
                  <button
                    onClick={() => setActiveTab("descripcion")}
                    className={`py-2 px-1.5 border-b-2 transition-all cursor-pointer ${
                      activeTab === "descripcion"
                        ? "border-brand-600 text-brand-600 dark:text-brand-400"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Descripción
                  </button>
                  {selectedProduct.ingredients && (
                    <button
                      onClick={() => setActiveTab("ingredientes")}
                      className={`py-2 px-1.5 border-b-2 transition-all cursor-pointer ${
                        activeTab === "ingredientes"
                          ? "border-brand-600 text-brand-600 dark:text-brand-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Ingredientes
                    </button>
                  )}
                  {selectedProduct.nutritional_info && Object.keys(selectedProduct.nutritional_info).length > 0 && (
                    <button
                      onClick={() => setActiveTab("nutricion")}
                      className={`py-2 px-1.5 border-b-2 transition-all cursor-pointer ${
                        activeTab === "nutricion"
                          ? "border-brand-600 text-brand-600 dark:text-brand-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Nutrición
                    </button>
                  )}
                  {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                    <button
                      onClick={() => setActiveTab("especificaciones")}
                      className={`py-2 px-1.5 border-b-2 transition-all cursor-pointer ${
                        activeTab === "especificaciones"
                          ? "border-brand-600 text-brand-600 dark:text-brand-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Ficha Técnica
                    </button>
                  )}
                  {selectedProduct.commercial_details && (
                    <button
                      onClick={() => setActiveTab("comercial")}
                      className={`py-2 px-1.5 border-b-2 transition-all cursor-pointer ${
                        activeTab === "comercial"
                          ? "border-brand-600 text-brand-600 dark:text-brand-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Comercial
                    </button>
                  )}
                </div>

                <div className="py-3 text-xs text-muted-foreground flex-1 overflow-y-auto max-h-[240px] md:max-h-[160px] scrollbar-thin">
                  {activeTab === "descripcion" && (
                    <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                      {selectedProduct.long_description || selectedProduct.description || "Sin descripción detallada disponible."}
                    </p>
                  )}

                  {activeTab === "ingredientes" && (
                    <div className="space-y-1">
                      <h4 className="font-semibold text-foreground">Ingredientes y Alérgenos:</h4>
                      <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                        {selectedProduct.ingredients}
                      </p>
                    </div>
                  )}

                  {activeTab === "nutricion" && selectedProduct.nutritional_info && (
                    <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                            <th className="py-1.5 px-3">Componente</th>
                            <th className="py-1.5 px-3 text-right">Cantidad (por porción)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedProduct.nutritional_info).map(([key, val], idx) => (
                            <tr key={key} className={idx % 2 === 0 ? "bg-card" : "bg-muted/5"}>
                              <td className="py-1.5 px-3 font-medium text-foreground">{key}</td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-foreground/90">{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "especificaciones" && selectedProduct.specifications && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedProduct.specifications).map(([key, val]) => (
                        <div key={key} className="p-2 rounded border border-border bg-muted/10">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{key}</p>
                          <p className="text-xs text-foreground font-medium mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "comercial" && (
                    <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                      {selectedProduct.commercial_details}
                    </p>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* On-demand production request modal */}
      {requestProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setRequestProduct(null)}
          role="dialog"
          aria-modal="true"
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
                onClick={() => setRequestProduct(null)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {(() => {
                const qty = parseFloat(requestQty);
                const validQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
                const total = requestProduct.price * validQty;
                const advance = total * 0.5;
                return (
                  <>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                      <p className="font-medium">Stock insuficiente</p>
                      <p className="mt-1">
                        Puedes solicitar la producción de <strong>{validQty} {requestProduct.sales_unit_name || requestProduct.capacity_unit || requestProduct.unit}</strong> de{" "}
                        <strong>{requestProduct.name}</strong>. El stock actual no cubre tu pedido.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="request-qty" className="text-sm font-medium text-foreground">Cantidad solicitada</label>
                      <input
                        id="request-qty"
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
                          Envío a domicilio
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total estimado</span>
                        <span className="font-semibold tabular-nums">{total.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Anticipo obligatorio (50%)</span>
                        <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">{advance.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        El monto final se verificará contra el comprobante que adjuntes.
                      </p>
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
                  onClick={() => setRequestProduct(null)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!requestFile || requestSubmitting}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {requestSubmitting ? (
                    "Enviando..."
                  ) : (
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
    </div>
  );
}
