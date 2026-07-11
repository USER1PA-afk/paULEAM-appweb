"use client";
import { useState, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { useCachedQuery, invalidateCache } from "@shared/hooks/use-cached-query";
import type {
  Promotion,
  PromotionProduct,
  PromotionWithProducts,
} from "@entities/promotion";

/**
 * Claves de caché de este módulo (Regla 22 — invalidar tras toda mutación):
 *   "active_promotions" — promos activas para catálogo/carrito/checkout (anon ok).
 *   "promotions_admin"  — lista completa para el panel admin.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminPromotion extends PromotionWithProducts {
  /** Nombres de productos resueltos para la lista admin. */
  product_names: string[];
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: number;
}

interface PromotionRow extends Promotion {
  promotion_products?: PromotionProduct[];
}

// ─── useActivePromotions (catálogo / carrito / checkout — funciona anon) ─────

export function useActivePromotions() {
  return useCachedQuery<PromotionWithProducts[]>("active_promotions", async () => {
    const db = getInsforge();
    const { data, error } = await db.database.rpc("get_active_promotions", {});
    if (error) throw new Error((error as Error).message ?? "Error al cargar promociones");
    return (data as PromotionWithProducts[]) ?? [];
  });
}

// ─── usePromotions (lista admin) ──────────────────────────────────────────────

export function usePromotions() {
  const query = useCachedQuery<AdminPromotion[]>("promotions_admin", async () => {
    const db = getInsforge();
    const { data, error } = await db.database
      .from("promotions")
      .select("*, promotion_products(product_id, quantity)")
      .order("created_at", { ascending: false });
    if (error) throw new Error((error as Error).message ?? "Error al cargar promociones");

    const rows = (data as PromotionRow[]) ?? [];

    // Batch de nombres de producto para la lista
    const productIds = [
      ...new Set(rows.flatMap((r) => (r.promotion_products ?? []).map((p) => p.product_id))),
    ];
    const nameMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const { data: prodRows } = await db.database
        .from("products")
        .select("id, name")
        .in("id", productIds);
      ((prodRows as { id: string; name: string }[]) ?? []).forEach((p) => {
        nameMap[p.id] = p.name;
      });
    }

    return rows.map((r) => {
      const products = r.promotion_products ?? [];
      const { promotion_products: _pp, ...promo } = r;
      return {
        ...promo,
        products,
        product_names: products.map((p) => nameMap[p.product_id] ?? "—"),
      };
    });
  });

  return { promotions: query.data ?? [], loading: query.loading, error: query.error, refetch: query.refetch };
}

// ─── usePromotion (edición) ───────────────────────────────────────────────────

export function usePromotion(id: string | null) {
  const query = useCachedQuery<PromotionWithProducts | null>(
    `promotions_admin:${id}`,
    async () => {
      if (!id) return null;
      const db = getInsforge();
      const { data, error } = await db.database
        .from("promotions")
        .select("*, promotion_products(product_id, quantity)")
        .eq("id", id)
        .single();
      if (error) throw new Error((error as Error).message ?? "Promoción no encontrada");
      const row = data as PromotionRow;
      const { promotion_products: pp, ...promo } = row;
      return { ...promo, products: pp ?? [] };
    },
    { enabled: !!id }
  );

  return { promotion: query.data ?? null, loading: query.loading, error: query.error, refetch: query.refetch };
}

// ─── usePromotionMutations ────────────────────────────────────────────────────

export function usePromotionMutations() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => invalidateCache("promotions_admin", "active_promotions");

  async function insertLines(promotionId: string, lines: PromotionProduct[]) {
    const db = getInsforge();
    return db.database.from("promotion_products").insert(
      lines.map((l) => ({
        promotion_id: promotionId,
        product_id: l.product_id,
        quantity: l.quantity,
      }))
    );
  }

  async function createPromotion(
    data: Partial<Promotion>,
    lines: PromotionProduct[]
  ): Promise<string | null> {
    setSaving(true); setError(null);
    const db = getInsforge();
    const { data: result, error: err } = await db.database
      .from("promotions")
      .insert(data)
      .select("id")
      .single();
    if (err || !result) {
      setSaving(false);
      setError((err as Error)?.message ?? "No se pudo crear la promoción");
      return null;
    }
    const promoId = (result as { id: string }).id;

    const { error: linesErr } = await insertLines(promoId, lines);
    if (linesErr) {
      // No dejar promos huérfanas sin productos
      await db.database.from("promotions").delete().eq("id", promoId);
      setSaving(false);
      setError((linesErr as Error).message ?? "No se pudieron guardar los productos de la promoción");
      return null;
    }

    setSaving(false);
    invalidate();
    return promoId;
  }

  async function updatePromotion(
    id: string,
    data: Partial<Promotion>,
    lines: PromotionProduct[]
  ): Promise<boolean> {
    setSaving(true); setError(null);
    const db = getInsforge();
    const { error: err } = await db.database
      .from("promotions")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) {
      setSaving(false);
      setError((err as Error).message ?? "No se pudo actualizar la promoción");
      return false;
    }

    // Reemplazo simple de líneas: delete + reinsert
    const { error: delErr } = await db.database
      .from("promotion_products")
      .delete()
      .eq("promotion_id", id);
    if (delErr) {
      setSaving(false);
      setError((delErr as Error).message ?? "No se pudieron actualizar los productos");
      return false;
    }
    const { error: linesErr } = await insertLines(id, lines);
    setSaving(false);
    if (linesErr) {
      setError((linesErr as Error).message ?? "No se pudieron guardar los productos de la promoción");
      return false;
    }

    invalidate();
    invalidateCache(`promotions_admin:${id}`);
    return true;
  }

  async function toggleActive(id: string, current: boolean): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("promotions")
      .update({ is_active: !current, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) { setError((err as Error).message); return false; }
    invalidate();
    invalidateCache(`promotions_admin:${id}`);
    return true;
  }

  async function deletePromotion(id: string): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("promotions")
      .delete()
      .eq("id", id); // ON DELETE CASCADE elimina las líneas
    if (err) { setError((err as Error).message); return false; }
    invalidate();
    return true;
  }

  return { createPromotion, updatePromotion, toggleActive, deletePromotion, saving, error, setError };
}

// ─── useProductOptions (selects del formulario) ───────────────────────────────

export function useProductOptions() {
  const query = useCachedQuery<ProductOption[]>("promo_product_options", async () => {
    const db = getInsforge();
    const { data, error } = await db.database
      .from("products")
      .select("id, name, sku, price")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0)
      .order("name");
    if (error) throw new Error((error as Error).message ?? "Error al cargar productos");
    return (data as ProductOption[]) ?? [];
  });

  const refetch = useCallback(() => query.refetch(), [query.refetch]);
  return { products: query.data ?? [], loading: query.loading, refetch };
}
