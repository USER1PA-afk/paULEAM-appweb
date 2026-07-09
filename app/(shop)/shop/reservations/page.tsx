"use client";

import { useMyProductionRequests, uploadReceipt, type ProductionRequest } from "@features/production-requests/hooks";
import { usePaymentConfig } from "@features/checkout/hooks";
import { useState } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import Image from "next/image";
import { ImageOff, Upload, PackageCheck, Truck, Store, CreditCard, AlertCircle } from "lucide-react";

export default function MyReservationsPage() {
  const { requests, loading, refetch } = useMyProductionRequests();
  const { config: paymentConfig } = usePaymentConfig();
  const [payingRequest, setPayingRequest] = useState<ProductionRequest | null>(null);
  const [balanceFile, setBalanceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const insforge = getInsforge();

  const completedRequests = requests.filter((r) => r.status === "COMPLETED" || r.status === "PENDING_PRODUCTION" || r.status === "IN_PRODUCTION");

  async function handleBalancePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingRequest || !balanceFile) return;

    setSubmitting(true);
    setMessage(null);

    const { path, error: uploadError } = await uploadReceipt(balanceFile);
    if (uploadError || !path) {
      setMessage({ text: uploadError ?? "Error al subir comprobante", type: "error" });
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await insforge.database
      .from("production_requests")
      .update({ balance_receipt_url: path })
      .eq("id", payingRequest.id);

    setSubmitting(false);

    if (updateError) {
      setMessage({ text: (updateError as Error).message, type: "error" });
      return;
    }

    setPayingRequest(null);
    setBalanceFile(null);
    setMessage({ text: "Comprobante enviado. El saldo será verificado antes de la entrega.", type: "success" });
    refetch();
    setTimeout(() => setMessage(null), 5000);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-1.5 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Mis Reservas Exclusivas
        </h1>
        <p className="text-sm text-muted-foreground">
          Stock producido exclusivamente para ti. Paga el saldo pendiente antes o durante la entrega.
        </p>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-5 rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : completedRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 text-muted-foreground">
          <PackageCheck aria-hidden="true" className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No tienes reservas activas</p>
          <p className="text-sm mt-1">Tus solicitudes de producción bajo demanda aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedRequests.map((request) => {
            const product = request.products;
            const balance = request.total_amount - request.amount_paid;
            const isPaid = request.balance_paid_at != null;
            return (
              <div
                key={request.id}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <div className="relative h-32 w-full sm:w-32 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {product?.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff aria-hidden="true" className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{product?.name ?? "Producto"}</h3>
                        <p className="text-xs text-muted-foreground">{product?.sku}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                        {request.fulfillment_type === "PICK-UP_IN_PLANT" ? (
                          <><Store className="h-3 w-3" /> Retiro en planta</>
                        ) : (
                          <><Truck className="h-3 w-3" /> Envío</>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cantidad</p>
                        <p className="font-medium tabular-nums">{request.quantity_requested} {product?.sales_unit_name || product?.unit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total</p>
                        <p className="font-medium tabular-nums">{request.total_amount.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pagado</p>
                        <p className="font-medium tabular-nums text-emerald-600">{request.amount_paid.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Saldo</p>
                        <p className={`font-bold tabular-nums ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                          {isPaid ? "$0.00" : balance.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
                        </p>
                      </div>
                    </div>

                    {request.status !== "COMPLETED" && (
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {request.status === "PENDING_PRODUCTION" && "Pago validado. Pronto iniciaremos la producción."}
                          {request.status === "IN_PRODUCTION" && "Tu pedido está en producción."}
                        </span>
                      </div>
                    )}

                    {request.status === "COMPLETED" && !isPaid && balance > 0 && (
                      <button
                        onClick={() => { setPayingRequest(request); setBalanceFile(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
                      >
                        <CreditCard className="h-4 w-4" />
                        Pagar saldo
                      </button>
                    )}

                    {isPaid && (
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <PackageCheck className="h-4 w-4" />
                        Saldo pagado — listo para entrega
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Balance payment modal */}
      {payingRequest && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setPayingRequest(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex flex-col w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">Pagar saldo pendiente</h2>
            </div>

            <form onSubmit={handleBalancePayment} className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {(() => {
                const balance = payingRequest.total_amount - payingRequest.amount_paid;
                return (
                  <>
                    <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Producto</span>
                        <span className="font-medium">{payingRequest.products?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Saldo a pagar</span>
                        <span className="font-bold text-lg tabular-nums">{balance.toLocaleString("es-EC", { style: "currency", currency: "USD" })}</span>
                      </div>
                    </div>

                    {paymentConfig && (
                      <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                        <p className="font-medium text-foreground">Datos para transferencia</p>
                        {paymentConfig.pichincha_account && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Pichincha:</span>{" "}
                            {paymentConfig.pichincha_holder} — {paymentConfig.pichincha_account} ({paymentConfig.pichincha_account_type})
                          </p>
                        )}
                        {paymentConfig.guayaquil_account && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Guayaquil:</span>{" "}
                            {paymentConfig.guayaquil_holder} — {paymentConfig.guayaquil_account} ({paymentConfig.guayaquil_account_type})
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Comprobante de pago del saldo</label>
                      <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-6 cursor-pointer hover:bg-muted/30 transition-colors">
                        <Upload aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
                        {balanceFile ? (
                          <span className="text-sm font-medium text-foreground">{balanceFile.name}</span>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-foreground">Adjuntar imagen o PDF</span>
                            <span className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP · máx. 10 MB</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => setBalanceFile(e.target.files?.[0] ?? null)}
                          className="sr-only"
                          required
                        />
                      </label>
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingRequest(null)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!balanceFile || submitting}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-all"
                >
                  {submitting ? "Enviando..." : "Enviar comprobante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
