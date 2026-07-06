"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  usePaymentConfig,
  usePaymentConfigMutations,
  paymentQrUrl,
  type PaymentConfig,
} from "@features/checkout/hooks";
import { getInsforge } from "@shared/lib/insforge/client";
import { Save, CircleCheck, Upload, Trash2 } from "lucide-react";

interface FormState {
  pichincha_holder:       string;
  pichincha_account:      string;
  pichincha_account_type: string;
  guayaquil_holder:       string;
  guayaquil_account:      string;
  guayaquil_account_type: string;
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
  guayaquil_holder:       "",
  guayaquil_account:      "",
  guayaquil_account_type: "Ahorro",
  paypal_email:           "",
  paypal_me:              "",
};

function toForm(config: PaymentConfig | null): FormState {
  if (!config) return EMPTY;
  return {
    pichincha_holder:       config.pichincha_holder       ?? "",
    pichincha_account:      config.pichincha_account      ?? "",
    pichincha_account_type: config.pichincha_account_type ?? "Ahorro",
    guayaquil_holder:       config.guayaquil_holder       ?? "",
    guayaquil_account:      config.guayaquil_account      ?? "",
    guayaquil_account_type: config.guayaquil_account_type ?? "Ahorro",
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

const QR_ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const QR_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export default function SettingsPage() {
  const { config, loading } = usePaymentConfig();
  const { saveConfig } = usePaymentConfigMutations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // QR upload state — kept separate from the form so the user can preview
  // and replace the QR without losing their other field edits.
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guayaquil QR
  const [gQrKey, setGQrKey] = useState<string | null>(null);
  const [gQrUploading, setGQrUploading] = useState(false);
  const [gQrError, setGQrError] = useState<string | null>(null);
  const gFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setForm(toForm(config));
      setQrKey(config.pichincha_qr_key ?? null);
      setGQrKey(config.guayaquil_qr_key ?? null);
    }
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

  async function handleQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!QR_ALLOWED_EXTENSIONS.includes(ext) || !QR_ALLOWED_MIME_TYPES.includes(file.type)) {
      setQrError("Solo se permiten imágenes PNG, JPG, WEBP, GIF o SVG.");
      return;
    }

    setQrUploading(true);
    setQrError(null);
    try {
      const insforge = getInsforge();
      const filePath = `pichincha/${Date.now()}.${ext}`;

      const { error: uploadError } = await insforge.storage
        .from("payment-qr")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Persist the key in payment_config so both storefront and POS read it.
      const { error: saveError } = await saveConfig({ pichincha_qr_key: filePath });
      if (saveError) throw new Error(saveError);

      setQrKey(filePath);
      setSaved(false);
    } catch (err: unknown) {
      setQrError(err instanceof Error ? err.message : "Error al subir el QR");
    } finally {
      setQrUploading(false);
    }
  }

  async function handleQrRemove() {
    if (!qrKey) return;
    if (!confirm("¿Eliminar el código QR actual? La tienda y el POS dejarán de mostrarlo.")) return;

    setQrUploading(true);
    setQrError(null);
    try {
      const insforge = getInsforge();
      const { error: delError } = await insforge.storage
        .from("payment-qr")
        .remove(qrKey);
      if (delError) throw delError;

      const { error: saveError } = await saveConfig({ pichincha_qr_key: null });
      if (saveError) throw new Error(saveError);

      setQrKey(null);
    } catch (err: unknown) {
      setQrError(err instanceof Error ? err.message : "Error al eliminar el QR");
    } finally {
      setQrUploading(false);
    }
  }

  async function handleGQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!QR_ALLOWED_EXTENSIONS.includes(ext) || !QR_ALLOWED_MIME_TYPES.includes(file.type)) {
      setGQrError("Solo se permiten imágenes PNG, JPG, WEBP, GIF o SVG.");
      return;
    }

    setGQrUploading(true);
    setGQrError(null);
    try {
      const insforge = getInsforge();
      const filePath = `guayaquil/${Date.now()}.${ext}`;

      const { error: uploadError } = await insforge.storage
        .from("payment-qr")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: saveErr } = await saveConfig({ guayaquil_qr_key: filePath });
      if (saveErr) throw new Error(saveErr);

      setGQrKey(filePath);
      setSaved(false);
    } catch (err: unknown) {
      setGQrError(err instanceof Error ? err.message : "Error al subir el QR");
    } finally {
      setGQrUploading(false);
    }
  }

  async function handleGQrRemove() {
    if (!gQrKey) return;
    if (!confirm("¿Eliminar el código QR de Guayaquil? La tienda dejará de mostrarlo.")) return;

    setGQrUploading(true);
    setGQrError(null);
    try {
      const insforge = getInsforge();
      const { error: delError } = await insforge.storage
        .from("payment-qr")
        .remove(gQrKey);
      if (delError) throw delError;

      const { error: saveErr } = await saveConfig({ guayaquil_qr_key: null });
      if (saveErr) throw new Error(saveErr);

      setGQrKey(null);
    } catch (err: unknown) {
      setGQrError(err instanceof Error ? err.message : "Error al eliminar el QR");
    } finally {
      setGQrUploading(false);
    }
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

  const qrPreviewSrc = paymentQrUrl(qrKey);
  const gQrPreviewSrc = paymentQrUrl(gQrKey);

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
          </div>

          {/* QR Pichincha / DeUna — same image is used by the storefront AND the POS */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Código QR (DeUna / Pichincha)</p>
                <p className="text-xs text-muted-foreground">
                  Sube una foto del QR. Se mostrará en la tienda y en el POS.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              {qrPreviewSrc ? (
                <div className="shrink-0 rounded-lg border border-border bg-white p-1.5">
                  <Image
                    src={qrPreviewSrc}
                    alt="Vista previa del QR Pichincha"
                    width={112}
                    height={112}
                    className="block h-28 w-28 object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  role="img"
                  aria-label="Sin QR cargado"
                  className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground text-center px-1"
                >
                  Sin imagen
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleQrFile}
                  className="hidden"
                  id="p-qr-file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={qrUploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {qrUploading ? "Subiendo…" : qrKey ? "Reemplazar" : "Subir imagen"}
                </button>
                {qrKey && (
                  <button
                    type="button"
                    onClick={handleQrRemove}
                    disabled={qrUploading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
            {qrError && (
              <p role="alert" className="text-xs text-destructive">{qrError}</p>
            )}
          </div>
        </section>

        {/* Banco Guayaquil */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Banco Guayaquil</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="g-holder"  label="Titular"          value={form.guayaquil_holder}       onChange={set("guayaquil_holder")}       placeholder="Nombre del titular" />
            <Field id="g-account" label="Número de Cuenta" value={form.guayaquil_account}      onChange={set("guayaquil_account")}      placeholder="1000000000" />
            <Field id="g-type"    label="Tipo de Cuenta"   value={form.guayaquil_account_type} onChange={set("guayaquil_account_type")} placeholder="Ahorro / Corriente" />
          </div>

          {/* QR Banco Guayaquil */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Código QR (Banco Guayaquil)</p>
                <p className="text-xs text-muted-foreground">
                  Sube una foto del QR. Se mostrará en la tienda al seleccionar este banco.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              {gQrPreviewSrc ? (
                <div className="shrink-0 rounded-lg border border-border bg-white p-1.5">
                  <Image
                    src={gQrPreviewSrc}
                    alt="Vista previa del QR Banco Guayaquil"
                    width={112}
                    height={112}
                    className="block h-28 w-28 object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  role="img"
                  aria-label="Sin QR cargado"
                  className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground text-center px-1"
                >
                  Sin imagen
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={gFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleGQrFile}
                  className="hidden"
                  id="g-qr-file"
                />
                <button
                  type="button"
                  onClick={() => gFileInputRef.current?.click()}
                  disabled={gQrUploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {gQrUploading ? "Subiendo…" : gQrKey ? "Reemplazar" : "Subir imagen"}
                </button>
                {gQrKey && (
                  <button
                    type="button"
                    onClick={handleGQrRemove}
                    disabled={gQrUploading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
            {gQrError && (
              <p role="alert" className="text-xs text-destructive">{gQrError}</p>
            )}
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
