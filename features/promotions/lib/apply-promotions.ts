import type {
  AppliedPromotion,
  PromotionType,
  PromotionWithProducts,
} from "@entities/promotion";
import { PROMOTION_TYPE_LABELS } from "@entities/promotion";

/**
 * Motor de descuentos de la tienda online — función pura, sin React ni SDK.
 *
 * REGLAS DE PRECEDENCIA (no negociables, reflejadas en la UI admin):
 *   1. COMBO primero, greedy: times = min(floor(qtyCarrito_p / qtyRequerida_p))
 *      sobre todos los miembros del combo. Puede aplicar varias veces.
 *      Si hay varios combos, se evalúan de mayor a menor descuento.
 *   2. Las líneas que participan en un combo aplicado quedan EXCLUIDAS de
 *      cualquier otra promoción (sin contabilidad de unidades parciales).
 *   3. Para cada línea restante se aplica SOLO el mejor descuento (mayor $).
 *      Sin stacking, nunca.
 *   4. Redondeo a 2 decimales por línea (round2); discountTotal = suma de
 *      líneas redondeadas. Ningún descuento supera el subtotal bruto de la
 *      línea (el total nunca puede quedar negativo).
 *   5. Los umbrales (NXM, POR_CANTIDAD, COMBO) usan Math.floor(quantity);
 *      DESCUENTO_SIMPLE usa la cantidad tal cual.
 *
 * El descuento de un COMBO se atribuye a la línea del primer miembro
 * presente en el carrito (simplificación documentada — el desglose real
 * queda en appliedPromos / orders.applied_promotions).
 */

export interface PromoCartItem {
  product_id: string;
  price: number;
  quantity: number;
}

export interface LineDiscount {
  discount: number;
  promoNames: string[];
}

export interface PromotionResult {
  /** Descuento por product_id (solo líneas con descuento > 0). */
  lineDiscounts: Record<string, LineDiscount>;
  /** Snapshot para orders.applied_promotions. */
  appliedPromos: AppliedPromotion[];
  /** Suma de descuentos por línea, redondeada a 2 decimales. */
  discountTotal: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Descuento en $ de una promo por-línea sobre (price, quantity). 0 si no aplica. */
function lineDiscountFor(
  promo: PromotionWithProducts,
  price: number,
  quantity: number
): number {
  const intQty = Math.floor(quantity);
  switch (promo.type) {
    case "DESCUENTO_SIMPLE": {
      const perUnit = promo.discount_percent != null
        ? (price * promo.discount_percent) / 100
        : Math.min(promo.discount_amount ?? 0, price);
      return quantity * perUnit;
    }
    case "POR_CANTIDAD": {
      if (promo.min_quantity == null || intQty < promo.min_quantity) return 0;
      return promo.discount_percent != null
        ? (quantity * price * promo.discount_percent) / 100
        : quantity * Math.max(price - (promo.special_unit_price ?? 0), 0);
    }
    case "NXM": {
      if (promo.nxm_take == null || promo.nxm_pay == null) return 0;
      const freeUnits =
        Math.floor(intQty / promo.nxm_take) * (promo.nxm_take - promo.nxm_pay);
      return freeUnits * price;
    }
    default:
      return 0;
  }
}

export function applyPromotions(
  items: PromoCartItem[],
  promotions: PromotionWithProducts[]
): PromotionResult {
  const lineDiscounts: Record<string, LineDiscount> = {};
  const appliedPromos: AppliedPromotion[] = [];
  if (items.length === 0 || promotions.length === 0) {
    return { lineDiscounts, appliedPromos, discountTotal: 0 };
  }

  const byProduct = new Map(items.map((i) => [i.product_id, i]));
  const consumed = new Set<string>(); // product_ids tomados por un combo

  const addLineDiscount = (productId: string, discount: number, name: string) => {
    const rounded = round2(discount);
    if (rounded <= 0) return;
    const existing = lineDiscounts[productId];
    if (existing) {
      existing.discount = round2(existing.discount + rounded);
      existing.promoNames.push(name);
    } else {
      lineDiscounts[productId] = { discount: rounded, promoNames: [name] };
    }
  };

  // ---- 1. COMBOs (mayor descuento primero) ----
  const combos = promotions
    .filter((p) => p.type === "COMBO" && p.bundle_price != null && p.products.length >= 2)
    .map((promo) => {
      let times = Infinity;
      let regularPrice = 0;
      for (const member of promo.products) {
        const item = byProduct.get(member.product_id);
        const available = item && !consumed.has(member.product_id)
          ? Math.floor(item.quantity)
          : 0;
        times = Math.min(times, Math.floor(available / member.quantity));
        regularPrice += member.quantity * (item?.price ?? 0);
      }
      if (!Number.isFinite(times) || times < 1) times = 0;
      // Clamp a 0: un combo mal configurado nunca se vuelve un recargo.
      const perApplication = Math.max(regularPrice - (promo.bundle_price ?? 0), 0);
      return { promo, times, discount: times * perApplication };
    })
    .filter((c) => c.times > 0 && c.discount > 0)
    .sort((a, b) => b.discount - a.discount);

  for (const { promo, times, discount } of combos) {
    // Un producto solo puede participar en un combo aplicado.
    if (promo.products.some((m) => consumed.has(m.product_id))) continue;
    const rounded = round2(discount);
    if (rounded <= 0) continue;

    const firstMember = promo.products.find((m) => byProduct.has(m.product_id));
    if (!firstMember) continue;
    addLineDiscount(firstMember.product_id, rounded, promo.name);
    promo.products.forEach((m) => consumed.add(m.product_id));
    appliedPromos.push({
      promotion_id: promo.id,
      name: promo.name,
      type: promo.type,
      times_applied: times,
      amount: rounded,
    });
  }

  // ---- 2. Mejor promo por línea restante (sin stacking) ----
  const linePromos = promotions.filter((p) => p.type !== "COMBO");
  for (const item of items) {
    if (consumed.has(item.product_id)) continue;

    let best: { promo: PromotionWithProducts; discount: number } | null = null;
    for (const promo of linePromos) {
      if (!promo.products.some((m) => m.product_id === item.product_id)) continue;
      const raw = lineDiscountFor(promo, item.price, item.quantity);
      // Clamp: nunca más que el subtotal bruto de la línea.
      const discount = round2(Math.min(raw, item.price * item.quantity));
      if (discount > 0 && (!best || discount > best.discount)) {
        best = { promo, discount };
      }
    }

    if (best) {
      addLineDiscount(item.product_id, best.discount, best.promo.name);
      appliedPromos.push({
        promotion_id: best.promo.id,
        name: best.promo.name,
        type: best.promo.type,
        times_applied: 1,
        amount: best.discount,
      });
    }
  }

  const discountTotal = round2(
    Object.values(lineDiscounts).reduce((sum, l) => sum + l.discount, 0)
  );
  return { lineDiscounts, appliedPromos, discountTotal };
}

// ============================
// Info para el catálogo
// ============================

export interface CatalogPromoInfo {
  badgeText: string;
  type: PromotionType;
  /** Solo para DESCUENTO_SIMPLE: precio con descuento (precio tachado en UI). */
  discountedPrice?: number;
}

const money = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/**
 * Badge (y precio rebajado si aplica) para la card/modal del catálogo.
 * Si varias promos tocan el producto, prioriza la que cambia el precio
 * mostrado (DESCUENTO_SIMPLE); si no, la primera encontrada.
 */
export function getCatalogPromoInfo(
  productId: string,
  price: number,
  promotions: PromotionWithProducts[]
): CatalogPromoInfo | null {
  let fallback: CatalogPromoInfo | null = null;

  for (const promo of promotions) {
    if (!promo.products.some((m) => m.product_id === productId)) continue;

    switch (promo.type) {
      case "DESCUENTO_SIMPLE": {
        const perUnit = promo.discount_percent != null
          ? (price * promo.discount_percent) / 100
          : Math.min(promo.discount_amount ?? 0, price);
        const discounted = round2(Math.max(price - perUnit, 0));
        const badgeText = promo.discount_percent != null
          ? `−${promo.discount_percent}%`
          : `−${money(promo.discount_amount ?? 0)}`;
        return { badgeText, type: promo.type, discountedPrice: discounted };
      }
      case "POR_CANTIDAD": {
        if (!fallback && promo.min_quantity != null) {
          fallback = {
            badgeText: promo.discount_percent != null
              ? `Lleva ${promo.min_quantity}+ −${promo.discount_percent}%`
              : `Lleva ${promo.min_quantity}+ a ${money(promo.special_unit_price ?? 0)}`,
            type: promo.type,
          };
        }
        break;
      }
      case "NXM": {
        if (!fallback && promo.nxm_take != null && promo.nxm_pay != null) {
          fallback = { badgeText: `${promo.nxm_take}x${promo.nxm_pay}`, type: promo.type };
        }
        break;
      }
      case "COMBO": {
        if (!fallback) fallback = { badgeText: "Combo", type: promo.type };
        break;
      }
    }
  }
  return fallback;
}

/**
 * Resumen legible de la config de una promo (lista admin).
 * Ej.: "3x2", "−10% desde 3 uds", "Combo a $5.00", "−$1.50 por unidad".
 */
export function promotionConfigSummary(promo: PromotionWithProducts): string {
  switch (promo.type) {
    case "DESCUENTO_SIMPLE":
      return promo.discount_percent != null
        ? `−${promo.discount_percent}%`
        : `−${money(promo.discount_amount ?? 0)} por unidad`;
    case "POR_CANTIDAD":
      return promo.discount_percent != null
        ? `−${promo.discount_percent}% desde ${promo.min_quantity} uds`
        : `${money(promo.special_unit_price ?? 0)}/ud desde ${promo.min_quantity} uds`;
    case "NXM":
      return `${promo.nxm_take}x${promo.nxm_pay}`;
    case "COMBO":
      return `Combo a ${money(promo.bundle_price ?? 0)}`;
    default:
      return PROMOTION_TYPE_LABELS[promo.type];
  }
}
