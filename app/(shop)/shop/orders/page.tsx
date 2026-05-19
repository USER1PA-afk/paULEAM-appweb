"use client";

import { useUserOrders, pickupCode, receiptProxyUrl } from "@features/checkout/hooks";
import { useAuth } from "@features/auth/hooks";
import { useState } from "react";
import Link from "next/link";
import { getInsforge } from "@shared/lib/insforge/client";
import {
  Package,
  LockKeyhole,
  ChevronDown,
  ChevronUp,
  Receipt,
  Tag,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatCurrency } from "@shared/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; text: string; message?: string }
> = {
  PENDIENTE: {
    label: "Pendiente",
    dot: "bg-yellow-500",
    bg: "bg-white dark:bg-card border border-yellow-400",
    text: "text-yellow-700 dark:text-yellow-400 font-bold",
    message: "Tu pedido está en espera de comprobante.",
  },
  PAGADO: {
    label: "En Revisión",
    dot: "bg-blue-500",
    bg: "bg-white dark:bg-card border border-blue-400",
    text: "text-blue-700 dark:text-blue-400 font-bold",
    message: "Tu pago está siendo revisado por el administrador.",
  },
  APROBADO: {
    label: "Aprobado",
    dot: "bg-green-500",
    bg: "bg-white dark:bg-card border border-green-400",
    text: "text-green-700 dark:text-green-400 font-bold",
    message: "¡Tu pedido fue aprobado! Puedes retirarlo con tu código.",
  },
  ENVIADO: {
    label: "Enviado",
    dot: "bg-violet-500",
    bg: "bg-white dark:bg-card border border-violet-400",
    text: "text-violet-700 dark:text-violet-400 font-bold",
    message: "Tu pedido está en camino.",
  },
  COMPLETADO: {
    label: "Completado",
    dot: "bg-emerald-500",
    bg: "bg-white dark:bg-card border border-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400 font-bold",
    message: "Pedido entregado. ¡Gracias por tu compra!",
  },
  CANCELADO: {
    label: "Cancelado",
    dot: "bg-red-500",
    bg: "bg-white dark:bg-card border border-red-400",
    text: "text-red-700 dark:text-red-400 font-bold",
    message: "Este pedido fue cancelado.",
  },
};

export default function MyOrdersPage() {
  const { isAuthenticated } = useAuth();
  const { orders, loading } = useUserOrders();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  /** Abre el comprobante en una nueva pestaña via el proxy autenticado */
  async function openReceipt(rawUrl: string) {
    setReceiptLoading(true);
    try {
      const proxyUrl = receiptProxyUrl(rawUrl);
      const insforge = getInsforge();
      const token = insforge.getHttpClient().getHeaders()["Authorization"]?.replace("Bearer ", "");

      const res = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener");
      // Revocar el blob URL después de un momento para liberar memoria
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error("[openReceipt]", err);
    } finally {
      setReceiptLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <LockKeyhole aria-hidden="true" className="h-14 w-14 mx-auto mb-4 opacity-25" />
        <h1 className="text-xl font-bold text-foreground">
          Inicia sesión para ver tus pedidos
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Necesitas una cuenta para acceder a tu historial de compras.
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial y estado de tus órdenes de compra.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div
            role="status"
            className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
          >
            <span className="sr-only">Cargando pedidos...</span>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-24 text-muted-foreground">
          <Package aria-hidden="true" className="h-12 w-12 mb-4 opacity-25" />
          <p className="text-base font-medium">No tienes pedidos aún</p>
          <p className="mt-1 text-sm">Explora el catálogo para realizar tu primera compra.</p>
          <Link
            href="/shop/catalog"
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Ver Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = STATUS_CONFIG[order.status] ?? {
              label: order.status,
              dot: "bg-gray-400",
              bg: "bg-gray-100",
              text: "text-gray-700",
            };
            const isOpen = expanded === order.id;
            const code = pickupCode(order.id);
            const itemCount = order.order_items?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Order row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left p-4 flex items-center gap-3 flex-wrap hover:bg-muted/30 transition-colors"
                >
                  {/* Receipt icon */}
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
                    <Receipt aria-hidden="true" className="h-5 w-5 text-brand-600" />
                  </div>

                  {/* Code + date */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-brand-700 dark:text-brand-300 text-sm">
                        {code}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text}`}>
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarDays aria-hidden="true" className="h-3 w-3" />
                      {formatDate(order.created_at)}
                      {itemCount > 0 && (
                        <span className="ml-2">· {itemCount} artículo{itemCount !== 1 ? "s" : ""}</span>
                      )}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-foreground">
                      {formatCurrency(order.total)}
                    </p>
                  </div>

                  {/* Expand icon */}
                  <div className="text-muted-foreground shrink-0">
                    {isOpen
                      ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      : <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    }
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border bg-card p-5 space-y-5">
                    {/* Pickup code highlight */}
                    <div className="rounded-lg border-2 border-brand-500 bg-white dark:bg-card shadow-sm px-4 py-3 flex items-center gap-3">
                      <Tag aria-hidden="true" className="h-6 w-6 text-brand-600 shrink-0" />
                      <div>
                        <p className="text-xs text-brand-600 font-bold uppercase tracking-wide">
                          Código de Retiro
                        </p>
                        <p className="font-mono font-bold text-2xl text-brand-700 tracking-widest">
                          {code}
                        </p>
                      </div>
                    </div>

                    {/* Status message */}
                    {status.message && (
                      <p className={`text-xs font-medium px-3 py-2 rounded-md ${status.bg} ${status.text}`}>
                        {status.message}
                      </p>
                    )}

                    {/* Products */}
                    {(order.order_items ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Productos
                        </p>
                        <div className="rounded-lg border border-border bg-background divide-y divide-border">
                          {order.order_items!.map((item) => (
                            <div key={item.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                              <div>
                                <span className="font-medium text-foreground">
                                  {item.products?.name ?? "Producto"}
                                </span>
                                <span className="text-muted-foreground ml-1.5">
                                  × {item.quantity} {item.products?.unit}
                                </span>
                              </div>
                              <span className="tabular-nums font-medium text-foreground">
                                {formatCurrency(item.subtotal)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-4 py-2.5 font-bold text-sm bg-muted/30">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment receipt link */}
                    {order.payment_receipt_url && (
                      <button
                        onClick={() => openReceipt(order.payment_receipt_url!)}
                        disabled={receiptLoading}
                        className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 underline transition-colors disabled:opacity-50"
                      >
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        {receiptLoading ? "Cargando..." : "Ver comprobante de pago"}
                      </button>
                    )}

                    {/* Shipping address */}
                    {order.shipping_address && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Dirección de Envío
                        </p>
                        <p className="text-sm text-foreground">{order.shipping_address}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
