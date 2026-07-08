"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Info, Package, CalendarClock, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { SearchableSelect } from "@shared/components/ui/searchable-select";
import { useProductOptions } from "@features/promotions/hooks";
import type {
  Promotion,
  PromotionProduct,
  PromotionType,
  PromotionWithProducts,
} from "@entities/promotion";
import { CreatePromotionSchema, PROMOTION_TYPE_LABELS } from "@entities/promotion";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
const textareaCls = inputCls + " resize-none";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

const TYPE_DESCRIPTIONS: Record<PromotionType, string> = {
  DESCUENTO_SIMPLE: "Precio rebajado sin condición de cantidad. Se muestra tachado en el catálogo.",
  POR_CANTIDAD:     "Descuento al llevar una cantidad mínima del mismo producto.",
  NXM:              "Lleva N unidades y paga solo M (ej. 3x2).",
  COMBO:            "Conjunto de productos distintos a precio de paquete.",
};

/** ISO (UTC) → valor para <input type="datetime-local"> en hora local. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface PromotionFormValues {
  data: Partial<Promotion>;
  lines: PromotionProduct[];
}

export function PromotionForm({
  initial,
  saving,
  serverError,
  onSubmit,
  submitLabel = "Guardar promoción",
}: {
  initial?: PromotionWithProducts | null;
  saving: boolean;
  serverError: string | null;
  onSubmit: (values: PromotionFormValues) => void;
  submitLabel?: string;
}) {
  const { products, loading: loadingProducts } = useProductOptions();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<PromotionType>(initial?.type ?? "DESCUENTO_SIMPLE");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [startDate, setStartDate] = useState(isoToLocalInput(initial?.start_date));
  const [endDate, setEndDate] = useState(isoToLocalInput(initial?.end_date));

  // DESCUENTO_SIMPLE / POR_CANTIDAD — modo de descuento
  const [simpleMode, setSimpleMode] = useState<"percent" | "amount">(
    initial?.discount_amount != null ? "amount" : "percent"
  );
  const [qtyMode, setQtyMode] = useState<"percent" | "special">(
    initial?.special_unit_price != null ? "special" : "percent"
  );
  const [discountPercent, setDiscountPercent] = useState(
    initial?.discount_percent != null ? String(initial.discount_percent) : ""
  );
  const [discountAmount, setDiscountAmount] = useState(
    initial?.discount_amount != null ? String(initial.discount_amount) : ""
  );
  const [specialPrice, setSpecialPrice] = useState(
    initial?.special_unit_price != null ? String(initial.special_unit_price) : ""
  );
  const [minQuantity, setMinQuantity] = useState(
    initial?.min_quantity != null ? String(initial.min_quantity) : ""
  );
  const [nxmTake, setNxmTake] = useState(initial?.nxm_take != null ? String(initial.nxm_take) : "");
  const [nxmPay, setNxmPay] = useState(initial?.nxm_pay != null ? String(initial.nxm_pay) : "");
  const [bundlePrice, setBundlePrice] = useState(
    initial?.bundle_price != null ? String(initial.bundle_price) : ""
  );

  // Producto único (SIMPLE / POR_CANTIDAD / NXM) y líneas de combo
  const [singleProductId, setSingleProductId] = useState(
    initial && initial.type !== "COMBO" ? (initial.products[0]?.product_id ?? "") : ""
  );
  const [comboLines, setComboLines] = useState<PromotionProduct[]>(
    initial && initial.type === "COMBO" && initial.products.length > 0
      ? initial.products
      : [
          { product_id: "", quantity: 1 },
          { product_id: "", quantity: 1 },
        ]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.name,
    meta: `${p.sku} · $${p.price.toFixed(2)}`,
  }));

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  function buildData(): PromotionFormValues {
    const data: Partial<Promotion> = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      is_active: isActive,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      discount_percent: null,
      discount_amount: null,
      special_unit_price: null,
      min_quantity: null,
      nxm_take: null,
      nxm_pay: null,
      bundle_price: null,
    };

    switch (type) {
      case "DESCUENTO_SIMPLE":
        if (simpleMode === "percent") data.discount_percent = num(discountPercent);
        else data.discount_amount = num(discountAmount);
        break;
      case "POR_CANTIDAD":
        data.min_quantity = num(minQuantity);
        if (qtyMode === "percent") data.discount_percent = num(discountPercent);
        else data.special_unit_price = num(specialPrice);
        break;
      case "NXM":
        data.nxm_take = num(nxmTake);
        data.nxm_pay = num(nxmPay);
        break;
      case "COMBO":
        data.bundle_price = num(bundlePrice);
        break;
    }

    const lines: PromotionProduct[] =
      type === "COMBO"
        ? comboLines.filter((l) => l.product_id)
        : singleProductId
          ? [{ product_id: singleProductId, quantity: 1 }]
          : [];

    return { data, lines };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data, lines } = buildData();
    const newErrors: Record<string, string> = {};

    const parsed = CreatePromotionSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        newErrors[String(issue.path[0] ?? "form")] = issue.message;
      }
    }

    if (type === "COMBO") {
      if (lines.length < 2) {
        newErrors.lines = "Un combo necesita al menos 2 productos.";
      } else if (new Set(lines.map((l) => l.product_id)).size !== lines.length) {
        newErrors.lines = "No repitas el mismo producto en el combo.";
      }
    } else if (lines.length === 0) {
      newErrors.lines = "Selecciona el producto de la promoción.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit({ data, lines });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-3xl">
      {serverError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* 1 · General */}
      <Section icon={Info} title="Información General" description="Nombre visible para el cliente y tipo de promoción.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre de la promoción" required error={errors.name}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: 3x2 en Queso Fresco"
                className={inputCls + (errors.name ? " border-destructive ring-1 ring-destructive" : "")}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descripción (opcional)">
              <textarea
                rows={2}
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle interno o texto adicional de la promoción..."
                className={textareaCls}
              />
            </Field>
          </div>
        </div>

        {/* Tipo — radio cards */}
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setErrors({}); }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                type === t
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-600"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium">{PROMOTION_TYPE_LABELS[t]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{TYPE_DESCRIPTIONS[t]}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* 2 · Configuración por tipo */}
      <Section
        icon={Package}
        title="Configuración"
        description="Si varias promociones aplican al mismo producto, se usa la de mayor descuento (no se acumulan)."
      >
        {type === "DESCUENTO_SIMPLE" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tipo de descuento" required>
              <select
                value={simpleMode}
                onChange={(e) => setSimpleMode(e.target.value as "percent" | "amount")}
                className={inputCls}
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="amount">Monto fijo por unidad ($)</option>
              </select>
            </Field>
            {simpleMode === "percent" ? (
              <Field label="Descuento (%)" required error={errors.discount_percent}>
                <input
                  type="number" min="0.01" max="100" step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="10"
                  className={inputCls}
                />
              </Field>
            ) : (
              <Field label="Descuento por unidad ($)" required error={errors.discount_percent}>
                <input
                  type="number" min="0.01" step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="1.50"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        )}

        {type === "POR_CANTIDAD" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cantidad mínima" required error={errors.min_quantity}>
              <input
                type="number" min="2" step="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="3"
                className={inputCls}
              />
            </Field>
            <Field label="Tipo de descuento" required>
              <select
                value={qtyMode}
                onChange={(e) => setQtyMode(e.target.value as "percent" | "special")}
                className={inputCls}
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="special">Precio especial por unidad ($)</option>
              </select>
            </Field>
            {qtyMode === "percent" ? (
              <Field label="Descuento (%)" required error={errors.discount_percent}>
                <input
                  type="number" min="0.01" max="100" step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="10"
                  className={inputCls}
                />
              </Field>
            ) : (
              <Field label="Precio especial ($/ud)" required error={errors.discount_percent}>
                <input
                  type="number" min="0" step="0.01"
                  value={specialPrice}
                  onChange={(e) => setSpecialPrice(e.target.value)}
                  placeholder="2.50"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        )}

        {type === "NXM" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Lleva (N)" required error={errors.nxm_take}>
              <input
                type="number" min="2" step="1"
                value={nxmTake}
                onChange={(e) => setNxmTake(e.target.value)}
                placeholder="3"
                className={inputCls}
              />
            </Field>
            <Field label="Paga (M)" required error={errors.nxm_pay}>
              <input
                type="number" min="1" step="1"
                value={nxmPay}
                onChange={(e) => setNxmPay(e.target.value)}
                placeholder="2"
                className={inputCls}
              />
            </Field>
            {nxmTake && nxmPay && Number(nxmPay) < Number(nxmTake) && (
              <div className="flex items-end pb-2">
                <p className="text-xs text-muted-foreground">
                  El cliente lleva {nxmTake} y paga {nxmPay} ({Number(nxmTake) - Number(nxmPay)} gratis).
                </p>
              </div>
            )}
          </div>
        )}

        {type === "COMBO" && (
          <Field label="Precio del combo ($)" required error={errors.bundle_price}>
            <input
              type="number" min="0.01" step="0.01"
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              placeholder="9.99"
              className={inputCls + " max-w-xs"}
            />
          </Field>
        )}

        {/* Productos */}
        <div className="pt-2 border-t border-border space-y-3">
          {type !== "COMBO" ? (
            <Field label="Producto" required error={errors.lines}>
              <SearchableSelect
                options={productOptions}
                value={singleProductId}
                onChange={setSingleProductId}
                placeholder={loadingProducts ? "Cargando productos..." : "Seleccionar producto..."}
                disabled={loadingProducts}
              />
            </Field>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Productos del combo <span className="text-destructive">*</span>
              </label>
              {comboLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      options={productOptions}
                      value={line.product_id}
                      onChange={(v) =>
                        setComboLines((ls) => ls.map((l, i) => (i === idx ? { ...l, product_id: v } : l)))
                      }
                      placeholder={loadingProducts ? "Cargando..." : "Seleccionar producto..."}
                      disabled={loadingProducts}
                    />
                  </div>
                  <input
                    type="number" min="1" step="1"
                    value={line.quantity}
                    onChange={(e) =>
                      setComboLines((ls) =>
                        ls.map((l, i) =>
                          i === idx ? { ...l, quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : l
                        )
                      )
                    }
                    className={inputCls + " w-20 text-center"}
                    aria-label="Cantidad requerida"
                  />
                  <button
                    type="button"
                    onClick={() => setComboLines((ls) => ls.filter((_, i) => i !== idx))}
                    disabled={comboLines.length <= 2}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors"
                    aria-label="Quitar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
              <button
                type="button"
                onClick={() => setComboLines((ls) => [...ls, { product_id: "", quantity: 1 }])}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar producto
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 3 · Vigencia y estado */}
      <Section icon={CalendarClock} title="Vigencia" description="Sin fechas, la promoción rige mientras esté activa.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inicio (opcional)">
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fin (opcional)" error={errors.end_date}>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border">
          <div
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              isActive ? "bg-brand-600" : "bg-muted-foreground/30"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                isActive ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              {isActive
                ? <Eye className="h-3.5 w-3.5 text-brand-600" />
                : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
              {isActive ? "Promoción activa" : "Promoción inactiva"}
            </p>
            <p className="text-xs text-muted-foreground">Solo las activas se aplican en la tienda</p>
          </div>
        </label>
      </Section>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          href="/admin/store/promotions"
          className="rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
