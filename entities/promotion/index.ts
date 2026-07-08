import { z } from "zod";

/**
 * Entity: Promotion
 *
 * Promociones de la tienda online (solo /shop — el POS no las lee).
 * 4 tipos, config excluyente por tipo (espejo del CHECK
 * promotions_type_config_chk en la migración 20260708000005):
 *
 *   DESCUENTO_SIMPLE — % o monto fijo por unidad, sin condición de cantidad.
 *   POR_CANTIDAD     — desde min_quantity unidades: % o precio especial/unidad.
 *   NXM              — lleva nxm_take, paga nxm_pay (ej. 3x2).
 *   COMBO            — conjunto de productos a bundle_price; aplica varias veces.
 */

export const PromotionTypeEnum = z.enum([
  "DESCUENTO_SIMPLE",
  "POR_CANTIDAD",
  "NXM",
  "COMBO",
]);
export type PromotionType = z.infer<typeof PromotionTypeEnum>;

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  DESCUENTO_SIMPLE: "Descuento simple",
  POR_CANTIDAD:     "Descuento por cantidad",
  NXM:              "Lleva N paga M",
  COMBO:            "Combo / Paquete",
};

export const PROMOTION_TYPE_COLORS: Record<PromotionType, string> = {
  DESCUENTO_SIMPLE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  POR_CANTIDAD:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NXM:              "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  COMBO:            "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

export const PromotionProductSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});
export type PromotionProduct = z.infer<typeof PromotionProductSchema>;

export const PromotionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional(),
  type: PromotionTypeEnum,
  is_active: z.boolean().default(true),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  discount_percent: z.number().gt(0).max(100).nullable().optional(),
  discount_amount: z.number().gt(0).nullable().optional(),
  special_unit_price: z.number().nonnegative().nullable().optional(),
  min_quantity: z.number().int().min(2).nullable().optional(),
  nxm_take: z.number().int().gt(1).nullable().optional(),
  nxm_pay: z.number().int().min(1).nullable().optional(),
  bundle_price: z.number().gt(0).nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Promotion = z.infer<typeof PromotionSchema>;

/** Promoción + sus líneas de producto (forma que devuelve get_active_promotions). */
export type PromotionWithProducts = Promotion & {
  products: PromotionProduct[];
};

export const CreatePromotionSchema = PromotionSchema.omit({
  id: true,
  created_by: true,
  created_at: true,
  updated_at: true,
}).superRefine((data, ctx) => {
  const bad = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  switch (data.type) {
    case "DESCUENTO_SIMPLE": {
      const hasPercent = data.discount_percent != null;
      const hasAmount = data.discount_amount != null;
      if (hasPercent === hasAmount) {
        bad("discount_percent", "Indica un % de descuento O un monto fijo (solo uno).");
      }
      break;
    }
    case "POR_CANTIDAD": {
      if (data.min_quantity == null) {
        bad("min_quantity", "La cantidad mínima es requerida (≥ 2).");
      }
      const hasPercent = data.discount_percent != null;
      const hasSpecial = data.special_unit_price != null;
      if (hasPercent === hasSpecial) {
        bad("discount_percent", "Indica un % de descuento O un precio especial por unidad (solo uno).");
      }
      break;
    }
    case "NXM": {
      if (data.nxm_take == null || data.nxm_pay == null) {
        bad("nxm_take", "Indica cuántas lleva y cuántas paga.");
      } else if (data.nxm_pay >= data.nxm_take) {
        bad("nxm_pay", "Las unidades que paga deben ser menores a las que lleva.");
      }
      break;
    }
    case "COMBO": {
      if (data.bundle_price == null) {
        bad("bundle_price", "El precio del combo es requerido.");
      }
      // La regla "≥ 2 líneas de producto" se valida en el formulario,
      // porque involucra el array hijo (promotion_products).
      break;
    }
  }

  if (data.start_date && data.end_date && data.end_date <= data.start_date) {
    bad("end_date", "La fecha de fin debe ser posterior a la de inicio.");
  }
});
export type CreatePromotion = z.infer<typeof CreatePromotionSchema>;

/** Snapshot guardado en orders.applied_promotions (JSONB). */
export const AppliedPromotionSchema = z.object({
  promotion_id: z.string().uuid(),
  name: z.string(),
  type: PromotionTypeEnum,
  times_applied: z.number().int().min(1),
  amount: z.number().nonnegative(),
});
export type AppliedPromotion = z.infer<typeof AppliedPromotionSchema>;
