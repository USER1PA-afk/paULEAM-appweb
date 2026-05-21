"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useCart } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useState, useEffect, useCallback } from "react";
import { Leaf, ImageOff, ShoppingCart as CartIcon, LogIn, X as XIcon } from "lucide-react";
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
  image_url: string | null;
  is_active: boolean;
  featured: boolean;
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
  const { addItem, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "auth" } | null>(null);
  const insforge = getInsforge();

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"descripcion" | "ingredientes" | "nutricion" | "especificaciones" | "comercial">("descripcion");

  const fetchProducts = useCallback(async () => {
    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, description, short_description, long_description, price, unit, image_url, is_active, featured, weight, ingredients, specifications, nutritional_info, commercial_details")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .order("name");
    setProducts((data as CatalogProduct[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch extra details when product is selected
  useEffect(() => {
    if (!selectedProduct) {
      setProductImages([]);
      setAvailableStock(null);
      setActiveImageUrl(null);
      return;
    }

    const fetchExtraDetails = async () => {
      setLoadingExtra(true);
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

        // Fetch stock
        const { data: stockRow } = await insforge.database
          .from("stock_summary")
          .select("stock_actual")
          .eq("product_id", selectedProduct.id)
          .single();
        
        if (stockRow) {
          setAvailableStock(Number(stockRow.stock_actual));
        } else {
          setAvailableStock(0);
        }
      } catch (err) {
        console.error("Error fetching extra details", err);
      } finally {
        setLoadingExtra(false);
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

  async function handleAddToCart(product: CatalogProduct) {
    const qty = quantities[product.id] || 1;
    if (qty <= 0) return;

    // Verificar autenticación antes de intentar agregar
    if (!isAuthenticated) {
      setMessage({ text: "Debes iniciar sesión para agregar productos al carrito.", type: "auth" });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setAddingId(product.id);
    setMessage(null);
    const result = await addItem(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        price: product.price,
        image_url: product.image_url,
      },
      qty
    );
    if (result.error) {
      setMessage({ text: result.error, type: "error" });
    } else {
      setMessage({ text: `${product.name} agregado al carrito`, type: "success" });
    }
    setAddingId(null);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Catálogo de Productos
        </h1>
        <p className="text-sm text-muted-foreground">
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
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
                    />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ImageOff aria-hidden="true" className="h-12 w-12 opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className="rounded-full bg-brand-600/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {product.unit}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4 pb-0">
                  <p className="text-[10px] font-mono text-muted-foreground">{product.sku}</p>
                  <h3 className="mt-1 font-semibold text-foreground leading-tight">
                    {product.name}
                  </h3>
                  {(product.short_description || product.description) && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {product.short_description || product.description}
                    </p>
                  )}
                  {product.featured && (
                    <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                      ✦ Destacado
                    </span>
                  )}

                  <div className="mt-auto pt-4">
                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {Number(product.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">por {product.unit}</p>
                  </div>
                </div>
              </div>

              {/* Action Area (Not opening modal) */}
              <div className="p-4 pt-3 flex flex-col gap-3">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={product.unit === "und" || product.unit === "unidades" ? "1" : "0.01"}
                      step={product.unit === "und" || product.unit === "unidades" ? "1" : "0.01"}
                      value={quantities[product.id] || 1}
                      onChange={(e) =>
                        setQuantities({ ...quantities, [product.id]: Number(e.target.value) })
                      }
                      aria-label={`Cantidad de ${product.name} (${product.unit})`}
                      className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={cartLoading || addingId === product.id}
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center cursor-pointer"
                    >
                      {addingId === product.id ? (
                        "Agregando..."
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <CartIcon aria-hidden="true" className="h-3.5 w-3.5" />
                          Agregar
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
                    Inicia sesión para comprar
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setSelectedProduct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all duration-200 scale-100 flex flex-col md:flex-row gap-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <XIcon className="h-5 w-5" />
            </button>

            {/* Left Side: Images */}
            <div className="w-full md:w-1/2 flex flex-col gap-4">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center shadow-inner">
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">SKU: {selectedProduct.sku}</p>
                  {selectedProduct.weight && (
                    <p className="text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 px-2 py-0.5 rounded">
                      Peso: {selectedProduct.weight} {selectedProduct.unit}
                    </p>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {selectedProduct.name}
                </h2>
              </div>

              {/* Price & Cart Actions */}
              <div className="rounded-xl bg-muted/30 p-4 border border-border space-y-4">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-3xl font-extrabold text-foreground tabular-nums">
                      {Number(selectedProduct.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">precio por {selectedProduct.unit}</p>
                  </div>
                  <div>
                    {availableStock !== null ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        availableStock <= 0
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : availableStock <= 5
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {availableStock <= 0
                          ? "Agotado temporalmente"
                          : `Disponible: ${availableStock} ${selectedProduct.unit}`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground animate-pulse">Consultando stock...</span>
                    )}
                  </div>
                </div>

                {isAuthenticated ? (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="modal-qty" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cantidad</label>
                      <input
                        id="modal-qty"
                        type="number"
                        min={selectedProduct.unit === "und" || selectedProduct.unit === "unidades" ? "1" : "0.01"}
                        step={selectedProduct.unit === "und" || selectedProduct.unit === "unidades" ? "1" : "0.01"}
                        value={quantities[selectedProduct.id] || 1}
                        onChange={(e) =>
                          setQuantities({ ...quantities, [selectedProduct.id]: Number(e.target.value) })
                        }
                        className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button
                      onClick={() => handleAddToCart(selectedProduct)}
                      disabled={cartLoading || addingId === selectedProduct.id || (availableStock !== null && availableStock <= 0)}
                      className="flex-1 mt-5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
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

                <div className="py-3 text-xs text-muted-foreground flex-1 overflow-y-auto max-h-[160px] scrollbar-thin">
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
      )}
    </div>
  );
}
