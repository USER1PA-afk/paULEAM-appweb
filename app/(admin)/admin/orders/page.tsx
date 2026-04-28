"use client";

import { useOrderManagement } from "@features/checkout/hooks";
import { formatDate, formatCurrency } from "@shared/lib/utils";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: "Pendiente", className: "bg-yellow-100 text-yellow-700" },
  PAGADO: { label: "Pagado", className: "bg-blue-100 text-blue-700" },
  APROBADO: { label: "Aprobado", className: "bg-green-100 text-green-700" },
  ENVIADO: { label: "Enviado", className: "bg-purple-100 text-purple-700" },
  COMPLETADO: {
    label: "Completado",
    className: "bg-emerald-100 text-emerald-700",
  },
  CANCELADO: { label: "Cancelado", className: "bg-red-100 text-red-700" },
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
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
                    className: "bg-gray-100 text-gray-700",
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
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {order.payment_receipt_url ? (
                          <a
                            href={order.payment_receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
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
                              className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => rejectOrder(order.id)}
                              className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
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
