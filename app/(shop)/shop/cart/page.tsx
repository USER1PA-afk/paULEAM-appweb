"use client";

import { useCart } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { DeliveryInfoBanner } from "@features/checkout/components/DeliveryInfoBanner";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Package, X } from "lucide-react";
import { formatCurrency } from "@shared/lib/utils";

export default function CartPage() {
  const { user } = useAuth();
  const { items, total, itemCount, removeItem, clearCart, isEmpty } = useCart(user?.id ?? null);

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <ShoppingCart aria-hidden="true" className="h-16 w-16 mx-auto mb-4 opacity-25" />
        <h1 className="text-2xl font-bold text-foreground">Tu carrito está vacío</h1>
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Carrito de Compras
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {itemCount} artículo{itemCount !== 1 ? "s" : ""} en tu carrito
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm"
            >
              {/* Thumbnail */}
              <div
                aria-hidden="true"
                className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden"
              >
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <Package className="h-7 w-7 text-muted-foreground opacity-40" />
                )}
              </div>

              {/* Content — stacks vertically on mobile */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {/* Top row: name + remove */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    aria-label={`Eliminar ${item.name} del carrito`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                {/* Bottom row: unit price + qty + subtotal */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)} / {item.sales_unit_name || item.capacity_unit || item.unit}
                  </p>
                  <div className="flex items-center gap-3 ml-auto">
                    <div className="text-center">
                      <p className="text-sm font-bold tabular-nums">{item.quantity}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sales_unit_name || item.capacity_unit || item.unit}</p>
                    </div>
                    <p className="font-semibold tabular-nums text-sm">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
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
          <DeliveryInfoBanner />

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-foreground">Resumen</h3>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Envío</span>
                <span className="text-xs text-muted-foreground">A calcular</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
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
