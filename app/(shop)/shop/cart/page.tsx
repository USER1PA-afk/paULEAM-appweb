"use client";

import { useCart } from "@features/checkout/hooks";
import Link from "next/link";
import { ShoppingCart, Package, X } from "lucide-react";

export default function CartPage() {
  const { items, total, itemCount, removeItem, clearCart, isEmpty } = useCart();

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-25" />
        <h1 className="text-2xl font-bold text-foreground">
          Tu carrito está vacío
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explora nuestro catálogo para agregar productos.
        </p>
        <Link
          href="/shop/catalog"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          Ver Catálogo →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Carrito de Compras
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {itemCount} artículo{itemCount !== 1 ? "s" : ""} en tu carrito
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-7 w-7 opacity-40" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {item.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {item.sku} · {item.unit}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold tabular-nums">{item.quantity}</p>
                <p className="text-[10px] text-muted-foreground">und</p>
              </div>
              <div className="text-right w-28">
                <p className="font-semibold tabular-nums">
                  {(item.price * item.quantity).toLocaleString("es-EC", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <button
                onClick={() => removeItem(item.product_id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Eliminar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            onClick={clearCart}
            className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            Vaciar carrito
          </button>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-foreground">Resumen</h3>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {total.toLocaleString("es-EC", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Envío</span>
                <span className="text-xs text-muted-foreground">A calcular</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">
                {total.toLocaleString("es-EC", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            <Link
              href="/shop/checkout"
              className="mt-6 block rounded-lg bg-brand-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-md hover:bg-brand-700 transition-colors"
            >
              Proceder al Checkout →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
