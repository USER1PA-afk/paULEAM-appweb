"use client";

import Image from "next/image";
import { usePaymentConfig } from "@features/checkout/hooks";
import type { PaymentConfig } from "@features/checkout/hooks";

const METHODS = [
  {
    value: "TRANSFERENCIA_PICHINCHA",
    label: "Banco Pichincha",
    sub:   "Transferencia Bancaria",
  },
  {
    value: "QR_PICHINCHA",
    label: "Banco Pichincha",
    sub:   "Código QR",
  },
  {
    value: "TRANSFERENCIA_GUAYAQUIL",
    label: "Banco Guayaquil",
    sub:   "Transferencia Bancaria",
  },
  {
    value: "PAYPAL",
    label: "PayPal",
    sub:   "PayPal.me o Correo electrónico",
  },
] as const;

interface Props {
  value: string | null;
  onChange: (method: string) => void;
}

function AccountDetail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <strong className="text-foreground font-semibold">{value}</strong>
    </p>
  );
}

function MethodDetails({ method, config }: { method: string; config: PaymentConfig }) {
  const empty = (
    <p className="text-xs text-muted-foreground">
      Datos de pago pendientes de configuración. Contacta al administrador.
    </p>
  );

  if (method === "TRANSFERENCIA_PICHINCHA") {
    if (!config.pichincha_account) return empty;
    return (
      <>
        <AccountDetail label="Titular"    value={config.pichincha_holder} />
        <AccountDetail label="Cuenta"     value={config.pichincha_account} />
        <AccountDetail label="Tipo"       value={config.pichincha_account_type} />
        <AccountDetail label="Cédula/RUC" value={config.pichincha_cedula} />
      </>
    );
  }

  if (method === "QR_PICHINCHA") {
    if (!config.pichincha_account && !config.pichincha_qr_path) return empty;
    return (
      <>
        {config.pichincha_qr_path && (
          <div className="flex justify-center py-1">
            <Image
              src={config.pichincha_qr_path}
              alt="Código QR Banco Pichincha"
              width={160}
              height={160}
              className="rounded-lg border border-border"
              unoptimized
            />
          </div>
        )}
        <AccountDetail label="Titular" value={config.pichincha_holder} />
        <AccountDetail label="Cuenta"  value={config.pichincha_account} />
      </>
    );
  }

  if (method === "TRANSFERENCIA_GUAYAQUIL") {
    if (!config.guayaquil_account) return empty;
    return (
      <>
        <AccountDetail label="Titular"    value={config.guayaquil_holder} />
        <AccountDetail label="Cuenta"     value={config.guayaquil_account} />
        <AccountDetail label="Tipo"       value={config.guayaquil_account_type} />
        <AccountDetail label="Cédula/RUC" value={config.guayaquil_cedula} />
      </>
    );
  }

  if (method === "PAYPAL") {
    if (!config.paypal_email && !config.paypal_me) return empty;
    const href = config.paypal_me
      ? (config.paypal_me.startsWith("http") ? config.paypal_me : `https://${config.paypal_me}`)
      : null;
    return (
      <>
        <AccountDetail label="Email" value={config.paypal_email} />
        {href && (
          <p className="text-sm">
            <span className="text-muted-foreground">PayPal.me: </span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              {config.paypal_me}
            </a>
          </p>
        )}
      </>
    );
  }

  return null;
}

export function PaymentMethodSelector({ value, onChange }: Props) {
  const { config, loading } = usePaymentConfig();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Método de Pago <span className="text-destructive">*</span>
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <div
            role="status"
            className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
          >
            <span className="sr-only">Cargando métodos de pago...</span>
          </div>
          Cargando métodos de pago…
        </div>
      ) : (
        <div className="space-y-2">
          {METHODS.map((method) => {
            const isSelected = value === method.value;
            return (
              <div key={method.value}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors
                    ${isSelected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                      : "border-border bg-card hover:border-brand-300 dark:hover:border-brand-700"
                    }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.value}
                    checked={isSelected}
                    onChange={() => onChange(method.value)}
                    className="h-4 w-4 accent-brand-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.sub}</p>
                  </div>
                </label>

                {isSelected && config && (
                  <div className="mx-1 rounded-b-lg border border-t-0 border-brand-200 bg-background px-4 py-3 space-y-1.5
                    dark:border-brand-800">
                    <MethodDetails method={method.value} config={config} />
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
