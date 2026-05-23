"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useCart } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useState, useEffect, useCallback } from "react";
import { Leaf, ImageOff, ShoppingCart as CartIcon, LogIn, X, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  short_description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  is_active: boolean;
  featured: boolean;
  conversion_factor: number;
  sales_unit_name: string | null;
  stock_actual: number;
  stock_available: number;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number | "">>({});
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "auth" } | null>(null);
  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    const { data } = await insforge.database
      .from("stock_summary")
      .select("product_id, name, sku, description, short_description, price, unit, image_url, is_active, featured, conversion_factor, sales_unit_name, stock_actual, stock_available")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .order("name");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedProducts = ((data as any[]) ?? []).map((p) => ({
      id: p.product_id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      short_description: p.short_description,
      price: Number(p.price),
      unit: p.unit,
      image_url: p.image_url,
      is_active: p.is_active,
      featured: p.featured,
      conversion_factor: Number(p.conversion_factor ?? 1.0),
      sales_unit_name: p.sales_unit_name,
      stock_actual: Number(p.stock_actual ?? 0),
      stock_available: Number(p.stock_available ?? 0),
    }));

    setProducts(mappedProducts);
    setLoading(false);
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  async function handleAddToCart(product: CatalogProduct, qtyOverride?: number) {
    const qty = qtyOverride !== undefined ? qtyOverride : (Number(quantities[product.id]) || 1);
    if (qty <= 0) return;

    const availableUnits = Math.floor(product.stock_available * product.conversion_factor);
    if (qty > availableUnits) {
      setMessage({ text: `Solo hay ${availableUnits} unidades disponibles.`, type: "error" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

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
        conversion_factor: product.conversion_factor,
        sales_unit_name: product.sales_unit_name,
      },
      qty
    );
    if (result.error) {
      setMessage({ text: result.error, type: "error" });
    } else {
      setMessage({ text: `${product.name} agregado al carrito`, type: "success" });
      fetchProducts(); // Refresh products to get updated stock
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
          {products.map((product) => {
            const availableUnits = Math.floor(product.stock_available * product.conversion_factor);

            return (
              <div
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5"
              >
                {/* Clickable Header and Info */}
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
                        {product.sales_unit_name || product.unit}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-4">
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

                    {/* Stock available badge */}
                    <div className="mt-2 text-xs flex justify-between items-center text-muted-foreground border-t border-border/50 pt-2">
                      <span>Stock comercial:</span>
                      <span className={availableUnits > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                        {availableUnits > 0 ? `${availableUnits} ${product.sales_unit_name || product.unit}s` : "Agotado"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buy Section (excludes clicks) */}
                <div className="p-4 pt-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold tabular-nums text-foreground">
                          {Number(product.price).toLocaleString("es-EC", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">por {product.sales_unit_name || product.unit}</p>
                      </div>
                    </div>

                    {isAuthenticated ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="1"
                          max={availableUnits > 0 ? availableUnits : 1}
                          step="1"
                          value={quantities[product.id] ?? ""}
                          placeholder="1"
                          disabled={availableUnits <= 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuantities({
                              ...quantities,
                              [product.id]: val === "" ? "" : Math.floor(Number(val)),
                            });
                          }}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            const maxLimit = availableUnits > 0 ? availableUnits : 1;
                            const clamped = Math.max(1, Math.min(maxLimit, Math.floor(val) || 1));
                            setQuantities({ ...quantities, [product.id]: clamped });
                          }}
                          aria-label={`Cantidad de ${product.name} (${product.sales_unit_name || product.unit})`}
                          className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={cartLoading || addingId === product.id || availableUnits <= 0}
                          className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center"
                        >
                          {addingId === product.id ? (
                            "Agregando..."
                          ) : availableUnits <= 0 ? (
                            "Agotado"
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
              </div>
            );
          })}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (() => {
        const prod = selectedProduct;
        const availableUnits = Math.floor(prod.stock_available * prod.conversion_factor);
        const physicalEquiv = Number((1 / prod.conversion_factor).toFixed(4)).toLocaleString("es-EC", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        });

        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md transition-all duration-300 animate-in fade-in"
          >
            <div className="relative bg-card text-foreground rounded-2xl border border-border max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              {/* Close button */}
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Cerrar modal"
                className="absolute top-4 right-4 z-10 rounded-full bg-background/80 p-2 text-muted-foreground hover:text-foreground backdrop-blur-sm transition-colors border border-border"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Product Image */}
              <div className="relative h-64 w-full bg-linear-to-br from-brand-50 to-muted flex items-center justify-center overflow-hidden">
                {prod.image_url ? (
                  <Image
                    src={prod.image_url}
                    alt={prod.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageOff className="h-16 w-16 opacity-20" />
                  </div>
                )}
                <div className="absolute bottom-4 left-4">
                  <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                    {prod.sales_unit_name || prod.unit}
                  </span>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{prod.sku}</p>
                  <h2 className="text-2xl font-bold text-foreground leading-tight mt-1">{prod.name}</h2>
                  {prod.featured && (
                    <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      ✦ Producto Destacado
                    </span>
                  )}
                </div>

                {prod.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {prod.description}
                  </p>
                )}

                {/* Transparency Info Box */}
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 dark:border-brand-900/30 dark:bg-brand-950/20 p-4 space-y-3">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-brand-900 dark:text-brand-200">
                        Transparencia de Unidad de Medida (UDM)
                      </h4>
                      <p className="text-xs text-brand-850/90 dark:text-brand-300/95 mt-1 leading-relaxed">
                        Para garantizar una alta precisión en la planificación de recetas, mermas y control de costos, nuestra planta almacena físicamente el stock en <strong>kilogramos (kg)</strong>. En el catálogo web, traducimos dinámicamente este stock a <strong>{prod.sales_unit_name || prod.unit}s</strong> comerciales para tu comodidad de compra.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-brand-100/50 dark:border-brand-900/20 pt-3 text-center">
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider font-semibold">Stock Comercial</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {availableUnits > 0 ? `${availableUnits} ${prod.sales_unit_name || prod.unit}s` : "Agotado"}
                      </p>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider font-semibold">Equivalente Físico</p>
                      <p className="text-lg font-bold text-foreground mt-0.5 font-mono">
                        {Number(prod.stock_available).toLocaleString("es-EC", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          useGrouping: false,
                        })} kg
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-muted-foreground italic">
                    Fórmula: 1 {prod.sales_unit_name || prod.unit} = {physicalEquiv} kg | Factor: {prod.conversion_factor} {prod.sales_unit_name || prod.unit}s/kg
                  </p>
                </div>

                {/* Price and Add to Cart Section */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Precio por {prod.sales_unit_name || prod.unit}</p>
                    <p className="text-2xl font-black text-foreground">
                      {Number(prod.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  {isAuthenticated ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={availableUnits > 0 ? availableUnits : 1}
                        step="1"
                        value={quantities[prod.id] ?? ""}
                        placeholder="1"
                        disabled={availableUnits <= 0}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuantities({
                            ...quantities,
                            [prod.id]: val === "" ? "" : Math.floor(Number(val)),
                          });
                        }}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          const maxLimit = availableUnits > 0 ? availableUnits : 1;
                          const clamped = Math.max(1, Math.min(maxLimit, Math.floor(val) || 1));
                          setQuantities({ ...quantities, [prod.id]: clamped });
                        }}
                        aria-label={`Cantidad a comprar (${prod.sales_unit_name || prod.unit})`}
                        className="w-20 rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-50"
                      />
                      <button
                        onClick={() => {
                          handleAddToCart(prod);
                          setSelectedProduct(null); // Close modal after adding
                        }}
                        disabled={cartLoading || addingId === prod.id || availableUnits <= 0}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {addingId === prod.id ? (
                          "Agregando..."
                        ) : availableUnits <= 0 ? (
                          "Agotado"
                        ) : (
                          <>
                            <CartIcon className="h-4 w-4" />
                            Agregar
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 px-4 py-2 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      <LogIn className="h-4 w-4" />
                      Inicia sesión para comprar
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
