"use client";

import Image from "next/image";
import { usePaymentConfig, paymentQrUrl } from "@features/checkout/hooks";
import type { PaymentConfig } from "@features/checkout/hooks";

const METHODS = [
  {
    value: "PICHINCHA",
    label: "Banco Pichincha",
    sub:   "Transferencia o código QR (DeUna)",
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

function PichinchaBlock({ config }: { config: PaymentConfig }) {
  const qrSrc = paymentQrUrl(config.pichincha_qr_key);
  const hasAccount = Boolean(
    config.pichincha_account || config.pichincha_holder || config.pichincha_cedula
  );
  const hasQr = Boolean(qrSrc);

  if (!hasAccount && !hasQr) {
    return (
      <p className="text-xs text-muted-foreground">
        Datos de pago pendientes de configuración. Contacta al administrador.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hasQr && qrSrc && (
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Image
            src={qrSrc}
            alt="Código QR Banco Pichincha (DeUna)"
            width={176}
            height={176}
            className="rounded-lg border border-border bg-white p-1"
            unoptimized
          />
          <p className="text-[11px] text-muted-foreground text-center max-w-[220px]">
            Escanea con la app DeUna o realiza una transferencia con los datos
            de abajo.
          </p>
        </div>
      )}

      {hasAccount && (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Datos para transferencia
          </p>
          <AccountDetail label="Titular"    value={config.pichincha_holder} />
          <AccountDetail label="Cuenta"     value={config.pichincha_account} />
          <AccountDetail label="Tipo"       value={config.pichincha_account_type} />
          <AccountDetail label="Cédula/RUC" value={config.pichincha_cedula} />
        </div>
      )}
    </div>
  );
}

function MethodDetails({ method, config }: { method: string; config: PaymentConfig }) {
  if (method === "PICHINCHA") {
    return <PichinchaBlock config={config} />;
  }

  if (method === "TRANSFERENCIA_GUAYAQUIL") {
    if (!config.guayaquil_account) {
      return (
        <p className="text-xs text-muted-foreground">
          Datos de pago pendientes de configuración. Contacta al administrador.
        </p>
      );
    }
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
    if (!config.paypal_email && !config.paypal_me) {
      return (
        <p className="text-xs text-muted-foreground">
          Datos de pago pendientes de configuración. Contacta al administrador.
        </p>
      );
    }
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
