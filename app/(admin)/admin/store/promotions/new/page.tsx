"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Tag } from "lucide-react";
import { usePromotionMutations } from "@features/promotions/hooks";
import { PromotionForm, type PromotionFormValues } from "@features/promotions/components";

export default function NewPromotionPage() {
  const router = useRouter();
  const { createPromotion, saving, error } = usePromotionMutations();

  async function handleSubmit({ data, lines }: PromotionFormValues) {
    const id = await createPromotion(data, lines);
    if (id) router.push("/admin/store/promotions");
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/store/promotions"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          <Link href="/admin/store/promotions" className="hover:text-foreground transition-colors">
            Promociones
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nueva</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Promoción</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aplica solo a la tienda online. El punto de venta cobra siempre el precio normal.
        </p>
      </div>

      <PromotionForm
        saving={saving}
        serverError={error}
        onSubmit={handleSubmit}
        submitLabel="Crear promoción"
      />
    </div>
  );
}
