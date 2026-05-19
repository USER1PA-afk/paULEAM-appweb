"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useCart } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useState, useEffect, useCallback } from "react";
import { Leaf, ImageOff, ShoppingCart as CartIcon, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
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

  const fetchProducts = useCallback(async () => {
    const { data } = await insforge.database
      .from("products")
      .select("id, name, sku, description, price, unit, image_url")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .order("name");
    setProducts((data as CatalogProduct[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[10px] font-mono text-muted-foreground">{product.sku}</p>
                <h3 className="mt-1 font-semibold text-foreground leading-tight">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="mt-auto pt-4 flex flex-col gap-3">
                  <div className="flex items-end justify-between">
                    <div>
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
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all text-center"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
