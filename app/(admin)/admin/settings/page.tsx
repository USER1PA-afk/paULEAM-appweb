"use client";

import { useEffect, useState } from "react";
import {
  usePaymentConfig,
  usePaymentConfigMutations,
  type PaymentConfig,
} from "@features/checkout/hooks";
import { Save, CircleCheck } from "lucide-react";

interface FormState {
  pichincha_holder:       string;
  pichincha_account:      string;
  pichincha_account_type: string;
  pichincha_cedula:       string;
  pichincha_qr_path:      string;
  guayaquil_holder:       string;
  guayaquil_account:      string;
  guayaquil_account_type: string;
  guayaquil_cedula:       string;
  paypal_email:           string;
  paypal_me:              string;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm
          placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const EMPTY: FormState = {
  pichincha_holder:       "",
  pichincha_account:      "",
  pichincha_account_type: "Ahorro",
  pichincha_cedula:       "",
  pichincha_qr_path:      "/pichincha-qr.png",
  guayaquil_holder:       "",
  guayaquil_account:      "",
  guayaquil_account_type: "Ahorro",
  guayaquil_cedula:       "",
  paypal_email:           "",
  paypal_me:              "",
};

function toForm(config: PaymentConfig | null): FormState {
  if (!config) return EMPTY;
  return {
    pichincha_holder:       config.pichincha_holder       ?? "",
    pichincha_account:      config.pichincha_account      ?? "",
    pichincha_account_type: config.pichincha_account_type ?? "Ahorro",
    pichincha_cedula:       config.pichincha_cedula        ?? "",
    pichincha_qr_path:      config.pichincha_qr_path      ?? "/pichincha-qr.png",
    guayaquil_holder:       config.guayaquil_holder       ?? "",
    guayaquil_account:      config.guayaquil_account      ?? "",
    guayaquil_account_type: config.guayaquil_account_type ?? "Ahorro",
    guayaquil_cedula:       config.guayaquil_cedula        ?? "",
    paypal_email:           config.paypal_email           ?? "",
    paypal_me:              config.paypal_me              ?? "",
  };
}

function toPayload(form: FormState): Partial<PaymentConfig> {
  // Convert empty strings to null before saving
  return Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
  ) as Partial<PaymentConfig>;
}

export default function SettingsPage() {
  const { config, loading } = usePaymentConfig();
  const { saveConfig } = usePaymentConfigMutations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (config) setForm(toForm(config));
  }, [config]);

  function set(key: keyof FormState) {
    return (val: string) => {
      setForm((prev) => ({ ...prev, [key]: val }));
      setSaved(false);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const { error } = await saveConfig(toPayload(form));
    if (error) setSaveError(error);
    else setSaved(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          role="status"
          className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
        >
          <span className="sr-only">Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de Pagos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de cuenta que verán los clientes al seleccionar un método de pago.
          Solo administradores pueden modificar esta información.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Banco Pichincha */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Banco Pichincha</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-holder"  label="Titular"         value={form.pichincha_holder}       onChange={set("pichincha_holder")}       placeholder="Nombre del titular" />
            <Field id="p-account" label="Número de Cuenta" value={form.pichincha_account}      onChange={set("pichincha_account")}      placeholder="2200000000" />
            <Field id="p-type"    label="Tipo de Cuenta"  value={form.pichincha_account_type} onChange={set("pichincha_account_type")} placeholder="Ahorro / Corriente" />
            <Field id="p-cedula"  label="Cédula / RUC"    value={form.pichincha_cedula}        onChange={set("pichincha_cedula")}        placeholder="0999999999" />
          </div>
          <Field
            id="p-qr"
            label="Ruta de imagen QR"
            value={form.pichincha_qr_path}
            onChange={set("pichincha_qr_path")}
            placeholder="/pichincha-qr.png"
            hint="Coloca el archivo PNG en la carpeta public/ y escribe aquí la ruta (ej. /pichincha-qr.png)."
          />
        </section>

        {/* Banco Guayaquil */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Banco Guayaquil</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="g-holder"  label="Titular"          value={form.guayaquil_holder}       onChange={set("guayaquil_holder")}       placeholder="Nombre del titular" />
            <Field id="g-account" label="Número de Cuenta" value={form.guayaquil_account}      onChange={set("guayaquil_account")}      placeholder="1000000000" />
            <Field id="g-type"    label="Tipo de Cuenta"   value={form.guayaquil_account_type} onChange={set("guayaquil_account_type")} placeholder="Ahorro / Corriente" />
            <Field id="g-cedula"  label="Cédula / RUC"     value={form.guayaquil_cedula}        onChange={set("guayaquil_cedula")}        placeholder="0999999999" />
          </div>
        </section>

        {/* PayPal */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">PayPal</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pp-email"
              label="Correo PayPal"
              value={form.paypal_email}
              onChange={set("paypal_email")}
              placeholder="pagos@ejemplo.com"
            />
            <Field
              id="pp-me"
              label="Enlace PayPal.me"
              value={form.paypal_me}
              onChange={set("paypal_me")}
              placeholder="paypal.me/tuusuario"
              hint="Incluye o no el https:// — se mostrará tal cual al cliente."
            />
          </div>
        </section>

        {saveError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {saveError}
          </div>
        )}

        {saved && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700
              dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          >
            <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            Configuración guardada correctamente.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold
              text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
