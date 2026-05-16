"use client";

import { useOrderManagement } from "@features/checkout/hooks";
import { formatDate, formatCurrency } from "@shared/lib/utils";

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  PENDIENTE: { label: "Pendiente", dot: "bg-yellow-500" },
  PAGADO: { label: "Pagado", dot: "bg-blue-500" },
  APROBADO: { label: "Aprobado", dot: "bg-accent-500" },
  ENVIADO: { label: "Enviado", dot: "bg-violet-500" },
  COMPLETADO: { label: "Completado", dot: "bg-accent-500" },
  CANCELADO: { label: "Cancelado", dot: "bg-red-500" },
};

export default function AdminOrdersPage() {
  const { orders, loading, approveOrder, rejectOrder } = useOrderManagement();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Órdenes de Venta
        </h1>
        <p className="mt-1 text-muted-foreground">
          Validación de pagos y gestión de pedidos del E-Commerce.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
            <span className="sr-only">Cargando órdenes...</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table aria-label="Órdenes de venta" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Total
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Comprobante
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No hay órdenes de venta
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const status = STATUS_LABELS[order.status] ?? {
                    label: order.status,
                    dot: "bg-gray-400",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {order.id.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.dot}`} />
                          <span className="text-xs font-medium text-foreground">{status.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {order.payment_receipt_url ? (
                          <a
                            href={order.payment_receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ver recibo de la orden ${order.id.substring(0, 8)} (abre en nueva pestaña)`}
                            className="text-xs text-brand-600 hover:text-brand-700 underline transition-colors"
                          >
                            Ver recibo
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin comprobante
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.status === "PAGADO" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveOrder(order.id)}
                              aria-label={`Aprobar orden ${order.id.substring(0, 8)}`}
                              className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => rejectOrder(order.id)}
                              aria-label={`Rechazar orden ${order.id.substring(0, 8)}`}
                              className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
