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
  Eye,
  Loader2,
  X,
  Download,
  Store,
  Truck,
} from "lucide-react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
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
    message: "¡Tu pago fue verificado! Te avisaremos cuando esté listo.",
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
  const { page, setPage, paged: pagedOrders, from, to, total, totalPages } = usePagination(orders);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    blobUrl: string;
    mimeType: string;
    originalUrl: string;
    orderCode: string;
  } | null>(null);

  async function openPreview(rawUrl: string, orderCode: string) {
    setPreviewLoading(true);
    try {
      const proxyUrl = receiptProxyUrl(rawUrl);
      const insforge = getInsforge();
      const token = insforge.getHttpClient().getHeaders()["Authorization"]?.replace("Bearer ", "");

      const res = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
      const blob = await res.blob();
      setPreview({ blobUrl: URL.createObjectURL(blob), mimeType: contentType || blob.type, originalUrl: proxyUrl, orderCode });
    } catch (err) {
      console.error("[openPreview]", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  }

  function downloadPreview() {
    if (!preview) return;
    const mimeExt: Record<string, string> = {
      "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
      "image/webp": ".webp", "image/gif": ".gif", "application/pdf": ".pdf",
    };
    const urlExt = preview.originalUrl.split("?")[0].match(/\.[a-zA-Z0-9]{2,5}$/)?.[0]?.toLowerCase() ?? "";
    const ext = urlExt || mimeExt[preview.mimeType] || "";
    const a = document.createElement("a");
    a.href = preview.blobUrl;
    a.download = `comprobante-${preview.orderCode}${ext}`;
    a.click();
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">

      {/* ─── Receipt preview modal ─── */}
      {(previewLoading || preview) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del comprobante"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closePreview}
        >
          <div
            className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl bg-card shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-foreground">Comprobante de pago</span>
              <button
                onClick={closePreview}
                aria-label="Cerrar vista previa"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-muted/30" style={{ height: "65vh" }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
                    <span className="sr-only">Cargando comprobante...</span>
                  </div>
                </div>
              ) : preview?.mimeType === "application/pdf" ? (
                <iframe
                  src={preview.blobUrl}
                  title="Comprobante de pago"
                  className="w-full border-0"
                  style={{ height: "65vh" }}
                />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview!.blobUrl}
                    alt="Comprobante de pago"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
              <button
                onClick={closePreview}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cerrar
              </button>
              {preview && (
                <button
                  onClick={downloadPreview}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  <Download className="h-4 w-4" /> Descargar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
          {pagedOrders.map((order) => {
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
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    aria-expanded={isOpen}
                    className="flex-1 text-left p-4 flex items-center gap-3 flex-wrap hover:bg-muted/30 transition-colors min-w-0"
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
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums text-foreground">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </button>

                  {/* Receipt preview button */}
                  {order.payment_receipt_url && (
                    <button
                      onClick={() => openPreview(order.payment_receipt_url!, code)}
                      disabled={previewLoading}
                      aria-label="Ver comprobante de pago"
                      title="Ver comprobante de pago"
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-colors disabled:opacity-50 dark:bg-brand-900/20 dark:border-brand-800 dark:hover:bg-brand-800/40"
                    >
                      {previewLoading
                        ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        : <Eye aria-hidden="true" className="h-4 w-4" />
                      }
                    </button>
                  )}

                  {/* Expand chevron */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    aria-label={isOpen ? "Contraer pedido" : "Expandir pedido"}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    {isOpen
                      ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      : <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    }
                  </button>
                </div>

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
                        {order.status === "APROBADO" && order.fulfillment_type === "RETIRO_EN_PLANTA"
                          ? "¡Tu pago fue verificado! Acércate a la planta con tu código para retirar tu pedido."
                          : order.status === "APROBADO" && order.fulfillment_type === "ENVIO"
                          ? "¡Tu pedido fue aprobado y está siendo preparado para envío!"
                          : status.message}
                      </p>
                    )}

                    {/* Fulfillment type badge */}
                    {order.fulfillment_type && (
                      <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium w-fit ${
                        order.fulfillment_type === "RETIRO_EN_PLANTA"
                          ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                          : "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800"
                      }`}>
                        {order.fulfillment_type === "RETIRO_EN_PLANTA"
                          ? <Store aria-hidden="true" className="h-3.5 w-3.5" />
                          : <Truck aria-hidden="true" className="h-3.5 w-3.5" />
                        }
                        {order.fulfillment_type === "RETIRO_EN_PLANTA" ? "Retiro en planta" : "Envío a domicilio"}
                      </div>
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
                                  × {item.quantity} {item.products?.sales_unit_name || item.products?.unit || 'Unidad'}
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
          <TablePagination
            page={page}
            totalPages={totalPages}
            from={from}
            to={to}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
