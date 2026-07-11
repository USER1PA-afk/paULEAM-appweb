"use client";

import { Tag } from "lucide-react";
import type { PromotionType } from "@entities/promotion";
import { PROMOTION_TYPE_COLORS } from "@entities/promotion";

/**
 * Pill de promoción para catálogo y listas admin.
 * El color viene del tipo (PROMOTION_TYPE_COLORS); el texto lo decide el
 * caller (getCatalogPromoInfo / promotionConfigSummary).
 */
export function PromoBadge({
  text,
  type = "DESCUENTO_SIMPLE",
  className = "",
}: {
  text: string;
  type?: PromotionType;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PROMOTION_TYPE_COLORS[type]} ${className}`}
    >
      <Tag className="h-3 w-3" />
      {text}
    </span>
  );
}
