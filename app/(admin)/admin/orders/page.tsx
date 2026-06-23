"use client";

import { useOrderManagement, pickupCode, receiptProxyUrl } from "@features/checkout/hooks";
import { formatDate, formatCurrency } from "@shared/lib/utils";
import { PAYMENT_METHOD_LABELS, FULFILLMENT_TYPE_LABELS } from "@entities/order";
import { useState } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { ChevronDown, ChevronUp, Receipt, X, Download, Eye, Loader2, Truck, Store, PackageCheck, FileText } from "lucide-react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
import {
  KioskReceiptModal,
  loadKioskReceipt,
  type KioskReceiptData,
} from "@shared/components/kiosk-receipt-modal";

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  PENDIENTE:  { label: "Pendiente",  dot: "bg-yellow-500",  bg: "bg-yellow-100 dark:bg-yellow-900/20",  text: "text-yellow-700 dark:text-yellow-300"  },
  PAGADO:     { label: "Pagado",     dot: "bg-blue-500",    bg: "bg-blue-100 dark:bg-blue-900/20",      text: "text-blue-700 dark:text-blue-300"      },
  APROBADO:   { label: "Aprobado",   dot: "bg-green-500",   bg: "bg-green-100 dark:bg-green-900/20",    text: "text-green-700 dark:text-green-300"    },
  ENVIADO:    { label: "Enviado",    dot: "bg-violet-500",  bg: "bg-violet-100 dark:bg-violet-900/20",  text: "text-violet-700 dark:text-violet-300"  },
  COMPLETADO: { label: "Completado", dot: "bg-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/20",text: "text-emerald-700 dark:text-emerald-300" },
  CANCELADO:  { label: "Cancelado",  dot: "bg-red-500",     bg: "bg-red-100 dark:bg-red-900/20",        text: "text-red-700 dark:text-red-300"        },
};

export default function AdminOrdersPage() {
  const { orders, loading, approveOrder, rejectOrder, confirmPickup } = useOrderManagement();
  const { page, setPage, paged: pagedOrders, from, to, total, totalPages } = usePagination(orders);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    blobUrl: string;
    mimeType: string;
    originalUrl: string;
    orderCode: string;
  } | null>(null);

  // POS kiosk receipt re-render (orders with invoice_generated_at set).
  const [kioskReceipt, setKioskReceipt] = useState<{
    data: KioskReceiptData | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });

  async function openPreview(rawUrl: string, orderCode: string) {
    setPreviewLoading(true);
    try {
      // Build the authenticated proxy URL (handles both new paths and legacy full URLs)
      const proxyUrl = receiptProxyUrl(rawUrl);

      // Obtain the current user's Bearer token to forward to the server proxy
      const insforge = getInsforge();
      const token = insforge.getHttpClient().getHeaders()["Authorization"]?.replace("Bearer ", "");

      const res = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(`Error ${res.status} al obtener comprobante`);

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

  async function openKioskReceipt(orderId: string) {
    setKioskReceipt({ data: null, loading: true, error: null });
    try {
      const data = await loadKioskReceipt(orderId);
      if (!data) {
        setKioskReceipt({ data: null, loading: false, error: "No se pudo cargar el comprobante" });
      } else {
        setKioskReceipt({ data, loading: false, error: null });
      }
    } catch (err) {
      setKioskReceipt({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Error al cargar el comprobante",
      });
    }
  }

  function closeKioskReceipt() {
    setKioskReceipt({ data: null, loading: false, error: null });
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

  async function handleApprove(orderId: string) {
    setActing(orderId);
    setActionError(null);
    const { error } = await approveOrder(orderId);
    if (error) setActionError(error);
    setActing(null);
  }

  async function handleReject(orderId: string) {
    setActing(orderId);
    setActionError(null);
    const { error } = await rejectOrder(orderId);
    if (error) setActionError(error);
    setActing(null);
  }

  async function handleConfirmPickup(orderId: string) {
    setActing(orderId);
    setActionError(null);
    const { error } = await confirmPickup(orderId);
    if (error) setActionError(error);
    setActing(null);
  }

  return (
    <div className="space-y-8">

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
            {/* Header */}
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

            {/* Preview body */}
            <div
              className="flex-1 min-h-0 overflow-auto bg-muted/30"
              style={{ height: "65vh" }}
            >
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

            {/* Footer */}
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Órdenes de Venta</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Validación de pagos y gestión de pedidos del E-Commerce.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
            <span className="sr-only">Cargando órdenes...</span>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-muted-foreground">
          <Receipt aria-hidden="true" className="h-10 w-10 mb-3 opacity-25" />
          <p className="font-medium">No hay órdenes de venta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const status = STATUS_CONFIG[order.status] ?? {
              label: order.status,
              dot: "bg-gray-400",
              bg: "bg-gray-100",
              text: "text-gray-700",
            };
            const isOpen = expanded === order.id;
            const code = pickupCode(order.id);
            const isActing = acting === order.id;
            const itemCount = order.order_items?.length ?? 0;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 p-4 flex-wrap">
                  {/* Pickup code */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-brand-700 dark:text-brand-300 text-sm">
                        {code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text}`}
                      >
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      {order.invoice_generated_at && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800"
                          title={`Comprobante generado el ${formatDate(order.invoice_generated_at)}`}
                        >
                          <FileText aria-hidden="true" className="h-2.5 w-2.5" />
                          Comprobante
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </span>
                      {itemCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · {itemCount} producto{itemCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {order.payment_method && (
                        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[order.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? order.payment_method}
                        </span>
                      )}
                      {order.fulfillment_type && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          order.fulfillment_type === "RETIRO_EN_PLANTA"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                            : "bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
                        }`}>
                          {order.fulfillment_type === "RETIRO_EN_PLANTA"
                            ? <Store aria-hidden="true" className="h-2.5 w-2.5" />
                            : <Truck aria-hidden="true" className="h-2.5 w-2.5" />
                          }
                          {FULFILLMENT_TYPE_LABELS[order.fulfillment_type as keyof typeof FULFILLMENT_TYPE_LABELS] ?? order.fulfillment_type}
                        </span>
                      )}
                      {order.delivery_date && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Truck aria-hidden="true" className="h-3 w-3" />
                          {new Date(order.delivery_date + "T12:00:00Z").toLocaleDateString("es-EC", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <span className="font-bold tabular-nums text-foreground">
                    {formatCurrency(order.total)}
                  </span>

                  {/* Approve / Reject (solo PAGADO) */}
                  {order.status === "PAGADO" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={isActing}
                        aria-label={`Aprobar orden ${code}`}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                      >
                        {isActing ? "..." : "Aprobar"}
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        disabled={isActing}
                        aria-label={`Rechazar orden ${code}`}
                        className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                      >
                        {isActing ? "..." : "Rechazar"}
                      </button>
                    </div>
                  )}

                  {/* Confirm pickup — APROBADO + RETIRO_EN_PLANTA only */}
                  {order.status === "APROBADO" && order.fulfillment_type === "RETIRO_EN_PLANTA" && (
                    <button
                      onClick={() => handleConfirmPickup(order.id)}
                      disabled={isActing}
                      aria-label={`Confirmar entrega de orden ${code}`}
                      className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <PackageCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      {isActing ? "..." : "Confirmar entrega"}
                    </button>
                  )}

                  {/* Receipt preview button — visible on card row when url exists */}
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

                  {/* Kiosk receipt re-render — only for orders whose
                      invoice_generated_at was set by the POS cashier. */}
                  {order.invoice_generated_at && (
                    <button
                      onClick={() => openKioskReceipt(order.id)}
                      disabled={kioskReceipt.loading}
                      aria-label="Ver comprobante de venta (POS)"
                      title="Comprobante generado en POS"
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-colors disabled:opacity-50 dark:bg-brand-900/20 dark:border-brand-800 dark:hover:bg-brand-800/40"
                    >
                      {kioskReceipt.loading
                        ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        : <FileText aria-hidden="true" className="h-4 w-4" />
                      }
                    </button>
                  )}

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    aria-label={isOpen ? "Ocultar detalles" : "Ver detalles"}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    {isOpen
                      ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      : <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    }
                  </button>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 p-5 space-y-4">
                    {/* Order items */}
                    {(order.order_items ?? []).length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Productos del Pedido
                        </p>
                        <div className="rounded-lg border border-border bg-background divide-y divide-border">
                          {order.order_items!.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-center px-4 py-2.5 text-sm"
                            >
                              <div>
                                <span className="font-medium text-foreground">
                                  {item.products?.name ?? "Producto eliminado"}
                                </span>
                                {item.products?.sku && (
                                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                                    {item.products.sku}
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-1.5">
                                  × {item.quantity} {item.products?.sales_unit_name || item.products?.unit || 'Unidad'}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="tabular-nums font-medium">{formatCurrency(item.subtotal)}</p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                  {formatCurrency(item.unit_price)} c/u
                                </p>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between px-4 py-2.5 font-bold text-sm bg-muted/30">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin detalle de productos.</p>
                    )}

                    {/* Meta info row */}
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {/* Payment receipt */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Comprobante
                        </p>
                        {order.payment_receipt_url ? (
                          <button
                            onClick={() => openPreview(order.payment_receipt_url!, code)}
                            disabled={previewLoading}
                            className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-400 transition-colors disabled:opacity-50 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300"
                          >
                            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                            Ver comprobante
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sin comprobante</span>
                        )}
                      </div>

                      {/* Shipping address */}
                      {order.shipping_address && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Dirección
                          </p>
                          <p className="text-xs text-foreground">{order.shipping_address}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {order.notes && (
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Notas
                          </p>
                          <p className="text-xs text-foreground">{order.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Delivery date + approved info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {order.delivery_date && (
                        <span className="inline-flex items-center gap-1">
                          <Truck aria-hidden="true" className="h-3.5 w-3.5" />
                          Entrega programada:{" "}
                          <strong className="font-medium text-foreground">
                            {new Date(order.delivery_date + "T12:00:00Z").toLocaleDateString("es-EC", {
                              weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                          </strong>
                        </span>
                      )}
                      {order.approved_at && (
                        <span>Aprobado el {formatDate(order.approved_at)}</span>
                      )}
                    </div>
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

      {/* ─── Kiosk receipt modal (re-rendered from order data) ─── */}
      <KioskReceiptModal
        data={kioskReceipt.data}
        loading={kioskReceipt.loading}
        errorMessage={kioskReceipt.error}
        onClose={closeKioskReceipt}
      />
    </div>
  );
}
