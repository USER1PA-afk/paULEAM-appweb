"use client";

import { useCart, useCheckout } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useState } from "react";
import Link from "next/link";

export default function CheckoutPage() {
  const { items, total, isEmpty, clearCart } = useCart();
  const { submitOrder, loading, error } = useCheckout();
  const { isAuthenticated } = useAuth();
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="text-5xl block mb-4">🔐</span>
        <h1 className="text-xl font-bold">Inicia sesión para continuar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Necesitas una cuenta para completar tu compra.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Iniciar Sesión
        </Link>
      </div>
    );
  }

  if (isEmpty && !success) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="text-5xl block mb-4">🛒</span>
        <h1 className="text-xl font-bold">Carrito vacío</h1>
        <Link
          href="/shop/catalog"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Ver Catálogo
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="text-6xl block mb-4">✅</span>
        <h1 className="text-2xl font-bold text-foreground">¡Orden Enviada!</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Tu comprobante de pago ha sido recibido. Un administrador revisará y
          aprobará tu orden pronto.
        </p>
        <Link
          href="/shop/catalog"
          className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Seguir Comprando
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return;

    const result = await submitOrder({
      items,
      total,
      shippingAddress: address,
      paymentReceipt: receipt,
      notes,
    });

    if (!result.error) {
      setSuccess(true);
      clearCart();
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Checkout
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Completa tu orden subiendo el comprobante de transferencia.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Order summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-3">Resumen de Orden</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-medium tabular-nums">
                  {(item.price * item.quantity).toLocaleString("es-EC", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {total.toLocaleString("es-EC", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Shipping address */}
        <div className="space-y-1.5">
          <label htmlFor="checkout-address" className="text-sm font-medium text-foreground">
            Dirección de Envío *
          </label>
          <textarea
            id="checkout-address"
            required
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Calle, ciudad, departamento..."
          />
        </div>

        {/* Payment receipt upload */}
        <div className="space-y-1.5">
          <label htmlFor="checkout-receipt" className="text-sm font-medium text-foreground">
            Comprobante de Transferencia *
          </label>
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center hover:border-brand-300 transition-colors">
            <input
              id="checkout-receipt"
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <label
              htmlFor="checkout-receipt"
              className="cursor-pointer space-y-2"
            >
              {receipt ? (
                <>
                  <span className="text-3xl block">📄</span>
                  <p className="text-sm font-medium text-foreground">
                    {receipt.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(receipt.size / 1024).toFixed(1)} KB — Click para cambiar
                  </p>
                </>
              ) : (
                <>
                  <span className="text-4xl block">📤</span>
                  <p className="text-sm font-medium text-foreground">
                    Subir comprobante de pago
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Imagen o PDF del recibo de transferencia bancaria
                  </p>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label htmlFor="checkout-notes" className="text-sm font-medium text-foreground">
            Notas (opcional)
          </label>
          <input
            id="checkout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Instrucciones especiales..."
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !receipt}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-50 transition-all"
        >
          {loading ? "Procesando..." : "Confirmar Orden"}
        </button>
      </form>
    </div>
  );
}
