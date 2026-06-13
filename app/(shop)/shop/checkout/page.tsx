"use client";

import { useCart, useCheckout, pickupCode, type CartItem } from "@features/checkout/hooks";
import { PaymentMethodSelector } from "@features/checkout/components/PaymentMethodSelector";
import { useAuth } from "@features/auth/hooks";
import { useState } from "react";
import Link from "next/link";
import {
  LockKeyhole,
  ShoppingCart,
  CircleCheck,
  FileText,
  Upload,
  Receipt,
  CalendarDays,
  Tag,
  ExternalLink,
  Truck,
  Store,
} from "lucide-react";
import { formatDate, formatCurrency } from "@shared/lib/utils";

interface ReceiptSnapshot {
  orderId: string;
  date: string;
  total: number;
  items: CartItem[];
  receiptUrl?: string | null;
  fulfillmentType: "ENVIO" | "RETIRO_EN_PLANTA";
}

export default function CheckoutPage() {
  const { items, total, isEmpty, clearCart } = useCart();
  const { submitOrder, loading, error } = useCheckout();
  const { isAuthenticated } = useAuth();

  const [fulfillmentType, setFulfillmentType] = useState<"ENVIO" | "RETIRO_EN_PLANTA">("RETIRO_EN_PLANTA");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptSnapshot | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <LockKeyhole aria-hidden="true" className="h-14 w-14 mx-auto mb-4 opacity-25" />
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
        <ShoppingCart aria-hidden="true" className="h-14 w-14 mx-auto mb-4 opacity-25" />
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

  if (success && receiptData) {
    const code = pickupCode(receiptData.orderId);
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-900/20 mb-4">
            <CircleCheck aria-hidden="true" className="h-10 w-10 text-accent-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">¡Orden Registrada!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu comprobante fue recibido. Un administrador revisará y aprobará tu orden en breve.
          </p>
        </div>

        {/* Receipt card */}
        <div className="rounded-xl border-2 border-brand-200 dark:border-brand-800 bg-card shadow-lg overflow-hidden">
          {/* Card header */}
          <div className="bg-brand-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Receipt aria-hidden="true" className="h-5 w-5" />
              <span className="font-bold text-sm uppercase tracking-wide">Comprobante de Pedido</span>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
              PAGADO
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Pickup code */}
            <div className="rounded-lg border-2 border-brand-500 bg-white dark:bg-card shadow-sm px-4 py-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Tag aria-hidden="true" className="h-5 w-5 text-brand-600" />
                <p className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                  Código de Retiro
                </p>
              </div>
              <p className="font-mono text-3xl font-bold text-brand-700 tracking-widest">
                {code}
              </p>
              <p className="mt-1 text-xs font-medium text-brand-600/80">
                {receiptData.fulfillmentType === "RETIRO_EN_PLANTA"
                  ? "Preséntalo al operario al llegar a la planta"
                  : "Guárdalo como referencia de tu pedido"}
              </p>
            </div>

            {/* Date */}
            <div className="flex items-center justify-between text-sm border-b border-border pb-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                Fecha del pedido
              </span>
              <span className="font-medium">
                {formatDate(receiptData.date)}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Productos
              </p>
              {receiptData.items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span className="text-foreground">
                    {item.name}{" "}
                    <span className="text-muted-foreground">
                      × {item.quantity} {item.unit}
                    </span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-base font-bold text-foreground">Total a Pagar</span>
              <span className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(receiptData.total)}
              </span>
            </div>

            {/* Status note */}
            <div className="rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
              <strong>Estado:</strong> Pendiente de aprobación.
              Recibirás confirmación una vez que el administrador valide tu pago.
            </div>

            {/* Payment receipt link */}
            {receiptData.receiptUrl && (
              <div className="flex justify-center pt-2">
                <a
                  href={receiptData.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 underline transition-colors"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Ver Comprobante Subido
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Link
            href="/shop/orders"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Ver Mis Pedidos
          </Link>
          <Link
            href="/shop/catalog"
            className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Seguir Comprando
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return;
    if (fulfillmentType === "ENVIO" && !address.trim()) return;
    if (!paymentMethod) return;

    const snapshot = [...items];

    const result = await submitOrder({
      items,
      total,
      shippingAddress: address,
      paymentReceipt: receipt,
      paymentMethod,
      fulfillmentType,
      notes,
    });

    if (!result.error && result.data) {
      setReceiptData({
        orderId: result.data.id,
        date: result.data.created_at ?? new Date().toISOString(),
        total: result.data.total,
        items: snapshot,
        receiptUrl: result.data.payment_receipt_url,
        fulfillmentType,
      });
      setSuccess(true);
      clearCart();
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Completa tu orden subiendo el comprobante de transferencia bancaria.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Order summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-3">Resumen de Orden</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.name} × {item.quantity} {item.unit}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Fulfillment type */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Forma de entrega</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFulfillmentType("RETIRO_EN_PLANTA")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-colors ${
                fulfillmentType === "RETIRO_EN_PLANTA"
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                  : "border-border bg-background text-muted-foreground hover:border-brand-300 hover:bg-muted/30"
              }`}
            >
              <Store aria-hidden="true" className="h-6 w-6" />
              <span>Retiro en planta</span>
            </button>
            <button
              type="button"
              onClick={() => setFulfillmentType("ENVIO")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-colors ${
                fulfillmentType === "ENVIO"
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                  : "border-border bg-background text-muted-foreground hover:border-brand-300 hover:bg-muted/30"
              }`}
            >
              <Truck aria-hidden="true" className="h-6 w-6" />
              <span>Envío a domicilio</span>
            </button>
          </div>
          {fulfillmentType === "RETIRO_EN_PLANTA" && (
            <p className="text-xs text-muted-foreground">
              El inventario se descontará cuando el operario confirme la entrega física en planta.
            </p>
          )}
        </div>

        {/* Shipping address — only required for delivery */}
        {fulfillmentType === "ENVIO" && (
          <div className="space-y-1.5">
            <label htmlFor="checkout-address" className="text-sm font-medium text-foreground">
              Dirección de Envío <span className="text-destructive">*</span>
            </label>
            <textarea
              id="checkout-address"
              required
              rows={2}
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Calle, ciudad, departamento..."
            />
          </div>
        )}

        {/* Payment method selector */}
        <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

        {/* Payment receipt upload */}
        <div className="space-y-1.5">
          <label htmlFor="checkout-receipt" className="text-sm font-medium text-foreground">
            Comprobante de Pago <span className="text-destructive">*</span>
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
            <label htmlFor="checkout-receipt" className="cursor-pointer space-y-2 block">
              {receipt ? (
                <>
                  <FileText aria-hidden="true" className="h-8 w-8 mx-auto text-brand-500" />
                  <p className="text-sm font-medium text-foreground">{receipt.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(receipt.size / 1024).toFixed(1)} KB — Clic para cambiar
                  </p>
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" className="h-8 w-8 mx-auto text-muted-foreground" />
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
          <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !receipt || (fulfillmentType === "ENVIO" && !address.trim()) || !paymentMethod}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-50 transition-all"
        >
          {loading ? "Procesando..." : "Confirmar Orden"}
        </button>
      </form>
    </div>
  );
}
