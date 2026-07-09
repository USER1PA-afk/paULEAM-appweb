"use client";

import { useProductionRequests, type ProductionRequest, type ProductionRequestStatus } from "@features/production-requests/hooks";
import { useState } from "react";
import { formatDate } from "@shared/lib/utils";
import { receiptProxyUrl } from "@features/checkout/hooks";
import {
  Factory,
  CheckCircle,
  Play,
  XCircle,
  DollarSign,
  FileText,
  Truck,
  Store,
} from "lucide-react";

const STATUS_LABELS: Record<ProductionRequestStatus, { label: string; dot: string; bg: string }> = {
  PROPOSAL:           { label: "Propuesta",         dot: "bg-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" },
  PENDING_PRODUCTION: { label: "Pago validado",     dot: "bg-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
  IN_PRODUCTION:      { label: "En producción",     dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" },
  COMPLETED:          { label: "Listo / Reservado", dot: "bg-emerald-500",bg: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" },
  REJECTED:           { label: "Rechazada",         dot: "bg-red-500",    bg: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" },
};

export default function ProductionRequestsAdminPage() {
  const { requests, loading, refetch, updateStatus, settleBalance } = useProductionRequests();
  const [filterStatus, setFilterStatus] = useState<ProductionRequestStatus | "">("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  // Modal state
  const [validateRequest, setValidateRequest] = useState<ProductionRequest | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [rejectRequest, setRejectRequest] = useState<ProductionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filtered = requests.filter((r) => (filterStatus ? r.status === filterStatus : true));

  function setError(id: string, msg: string | null) {
    setErrorById((prev) => {
      if (msg === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: msg };
    });
  }

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!validateRequest) return;
    setWorkingId(validateRequest.id);
    setError(validateRequest.id, null);

    const paid = parseFloat(amountPaid);
    if (!Number.isFinite(paid) || paid <= 0) {
      setError(validateRequest.id, "Ingresa un monto válido");
      setWorkingId(null);
      return;
    }

    const { error } = await updateStatus(validateRequest.id, "PENDING_PRODUCTION", {
      amount_paid: paid,
    });

    if (error) setError(validateRequest.id, error);
    setWorkingId(null);
    setValidateRequest(null);
    setAmountPaid("");
    if (!error) refetch();
  }

  async function handleStartProduction(request: ProductionRequest) {
    setWorkingId(request.id);
    setError(request.id, null);
    const { error } = await updateStatus(request.id, "IN_PRODUCTION");
    if (error) setError(request.id, error);
    setWorkingId(null);
    if (!error) refetch();
  }

  async function handleComplete(request: ProductionRequest) {
    setWorkingId(request.id);
    setError(request.id, null);
    const { error } = await updateStatus(request.id, "COMPLETED");
    if (error) setError(request.id, error);
    setWorkingId(null);
    if (!error) refetch();
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectRequest) return;
    setWorkingId(rejectRequest.id);
    setError(rejectRequest.id, null);

    if (!rejectionReason.trim()) {
      setError(rejectRequest.id, "Ingresa un motivo de rechazo");
      setWorkingId(null);
      return;
    }

    const { error } = await updateStatus(rejectRequest.id, "REJECTED", {
      rejection_reason: rejectionReason.trim(),
    });

    if (error) setError(rejectRequest.id, error);
    setWorkingId(null);
    setRejectRequest(null);
    setRejectionReason("");
    if (!error) refetch();
  }

  async function handleSettle(request: ProductionRequest) {
    if (!confirm("¿Confirmar que el cliente pagó el saldo pendiente? Se consumirá el stock reservado.")) return;
    setWorkingId(request.id);
    setError(request.id, null);
    const { error } = await settleBalance(request.id);
    if (error) setError(request.id, error);
    setWorkingId(null);
    if (!error) refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes de producción bajo demanda</h1>
          <p className="mt-1 text-muted-foreground">
            Revisa comprobantes, cambia estados y libera stock reservado.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Estado</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ProductionRequestStatus | "")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus("")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Cantidad</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Total / Pagado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Entrega</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No hay solicitudes de producción bajo demanda
                  </td>
                </tr>
              ) : (
                filtered.map((request) => {
                  const status = STATUS_LABELS[request.status];
                  const balance = request.total_amount - request.amount_paid;
                  return (
                    <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{request.products?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{request.products?.sku ?? ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{request.profiles?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{request.profiles?.email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {request.quantity_requested} {request.products?.sales_unit_name || request.products?.unit}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        <div>{request.total_amount.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</div>
                        <div className={`text-xs ${request.amount_paid >= request.total_amount ? "text-emerald-600" : "text-amber-600"}`}>
                          Pagado: {request.amount_paid.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
                        </div>
                        {request.status === "COMPLETED" && balance > 0 && !request.balance_paid_at && (
                          <div className="text-xs font-semibold text-red-600">
                            Saldo: {balance.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {request.fulfillment_type === "PICK-UP_IN_PLANT" ? (
                            <><Store className="h-3 w-3" /> Retiro</>
                          ) : (
                            <><Truck className="h-3 w-3" /> Envío</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg}`}>
                          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                        {request.created_at ? formatDate(request.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {request.receipt_url && (
                            <button
                              onClick={() => setPreviewUrl(receiptProxyUrl(request.receipt_url!))}
                              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                              title="Ver comprobante"
                            >
                              <FileText className="h-3 w-3 inline mr-1" />
                              Recibo
                            </button>
                          )}

                          {request.status === "PROPOSAL" && (
                            <>
                              <button
                                onClick={() => { setValidateRequest(request); setAmountPaid(String((request.total_amount * 0.5).toFixed(2))); }}
                                disabled={workingId === request.id}
                                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle className="h-3 w-3 inline mr-1" />
                                Validar pago
                              </button>
                              <button
                                onClick={() => setRejectRequest(request)}
                                disabled={workingId === request.id}
                                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="h-3 w-3 inline mr-1" />
                                Rechazar
                              </button>
                            </>
                          )}

                          {request.status === "PENDING_PRODUCTION" && (
                            <button
                              onClick={() => handleStartProduction(request)}
                              disabled={workingId === request.id}
                              className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              <Play className="h-3 w-3 inline mr-1" />
                              Iniciar producción
                            </button>
                          )}

                          {request.status === "IN_PRODUCTION" && (
                            <button
                              onClick={() => handleComplete(request)}
                              disabled={workingId === request.id}
                              className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                            >
                              <Factory className="h-3 w-3 inline mr-1" />
                              Completar
                            </button>
                          )}

                          {request.status === "COMPLETED" && !request.balance_paid_at && (
                            <button
                              onClick={() => handleSettle(request)}
                              disabled={workingId === request.id}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <DollarSign className="h-3 w-3 inline mr-1" />
                              Liquidar saldo
                            </button>
                          )}

                          {request.balance_paid_at && (
                            <span className="text-xs font-medium text-emerald-600">
                              Saldo pagado
                            </span>
                          )}
                        </div>
                        {errorById[request.id] && (
                          <div className="mt-2 text-xs text-red-600">{errorById[request.id]}</div>
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

      {/* Validate payment modal */}
      {validateRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setValidateRequest(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">Validar anticipo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {validateRequest.products?.name} — {validateRequest.quantity_requested} unidades
            </p>

            <div className="rounded-lg bg-muted/30 p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total estimado</span>
                <span className="font-medium tabular-nums">{validateRequest.total_amount.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anticipo mínimo (50%)</span>
                <span className="font-medium tabular-nums">{(validateRequest.total_amount * 0.5).toLocaleString("es-EC", { style: "currency", currency: "USD" })}</span>
              </div>
            </div>

            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="amount-paid" className="text-sm font-medium text-foreground">Monto verificado pagado</label>
                <input
                  id="amount-paid"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setValidateRequest(null)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={workingId === validateRequest.id}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {workingId === validateRequest.id ? "Validando..." : "Validar y continuar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setRejectRequest(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">Rechazar solicitud</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {rejectRequest.products?.name} — {rejectRequest.profiles?.full_name}
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="rejection-reason" className="text-sm font-medium text-foreground">Motivo del rechazo</label>
                <textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ej: comprobante ilegible, monto incorrecto..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectRequest(null)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={workingId === rejectRequest.id}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {workingId === rejectRequest.id ? "Rechazando..." : "Rechazar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground">Comprobante de pago</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-muted/30 min-h-[300px]">
              {previewUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewUrl}
                  title="Comprobante"
                  className="w-full h-[70vh] rounded-lg border border-border"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Comprobante de pago"
                  className="max-h-[70vh] max-w-full rounded-lg border border-border object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
