"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Tag } from "lucide-react";
import { usePromotion, usePromotionMutations } from "@features/promotions/hooks";
import { PromotionForm, type PromotionFormValues } from "@features/promotions/components";

export default function EditPromotionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;

  const { promotion, loading, error: loadError } = usePromotion(id);
  const { updatePromotion, saving, error } = usePromotionMutations();

  async function handleSubmit({ data, lines }: PromotionFormValues) {
    if (!id) return;
    const ok = await updatePromotion(id, data, lines);
    if (ok) router.push("/admin/store/promotions");
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
          <span className="text-foreground font-medium">Editar</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Promoción</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Los cambios se reflejan en la tienda al guardar.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand-600" />
        </div>
      ) : loadError || !promotion ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {loadError ?? "Promoción no encontrada."}
        </div>
      ) : (
        <PromotionForm
          initial={promotion}
          saving={saving}
          serverError={error}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
        />
      )}
    </div>
  );
}
