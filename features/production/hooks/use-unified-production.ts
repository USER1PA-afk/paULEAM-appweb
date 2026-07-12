"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { invalidateCache } from "@shared/hooks/use-cached-query";
import {
  UnifiedProductionOrder,
  UnifiedPresentation,
  CreateUnifiedPresentation,
} from "@entities/production/unified";
import { Recipe, RecipeIngredient } from "@entities/recipe";

// ──────────────────────────────────────────────────────────────────────────────
// Helper — conversión de unidades (espejo del DB unit_to_kg_factor)
// ──────────────────────────────────────────────────────────────────────────────

const UNIT_TO_KG: Record<string, number> = {
  kg:  1,
  g:   0.001,
  lb:  0.453592,
  lbs: 0.453592,
  oz:  0.0283495,
};

export function unitToKgFactor(unit: string): number {
  return UNIT_TO_KG[unit.toLowerCase()] ?? 1;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook: lista de órdenes unificadas
// ──────────────────────────────────────────────────────────────────────────────

export function useUnifiedOrders() {
  const insforge = getInsforge();
  const [orders, setOrders] = useState<UnifiedProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("unified_production_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setOrders((data as UnifiedProductionOrder[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando órdenes unificadas");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /**
   * Crear una orden en estado BORRADOR.
   * Las presentaciones se insertan por separado con upsertPresentations.
   */
  const createOrder = useCallback(
    async (payload: {
      recipe_id: string;
      batch_kg: number;
      waste_kg?: number;
      scheduled_date?: string | null;
      notes?: string | null;
    }) => {
      try {
        const { data, error: insertErr } = await insforge.database
          .from("unified_production_orders")
          .insert([{ ...payload, status: "BORRADOR", waste_kg: payload.waste_kg ?? 0 }])
          .select()
          .single();

        if (insertErr) throw insertErr;
        await fetchOrders();
        return { data: data as UnifiedProductionOrder, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Error al crear orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  /**
   * Actualizar waste_kg antes de completar.
   */
  const updateWaste = useCallback(
    async (orderId: string, waste_kg: number) => {
      try {
        const { error: upErr } = await insforge.database
          .from("unified_production_orders")
          .update({ waste_kg })
          .eq("id", orderId);

        if (upErr) throw upErr;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Error al guardar merma" };
      }
    },
    [insforge, fetchOrders]
  );

  /**
   * Ejecutar el RPC execute_unified_production.
   * Transacción atómica: EGRESOs ingredientes + EGRESOs materiales + INGRESOs terminados.
   * Si falla (stock insuficiente, validaciones), el error llega aquí y no se aplica nada.
   */
  const executeOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error: rpcErr } = await insforge.database.rpc(
          "execute_unified_production",
          { p_order_id: orderId }
        );

        if (rpcErr) throw rpcErr;
        invalidateCache("stock_summary", "inventory_ledger", "unified_production_orders");
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? "Error al ejecutar producción";
        return { error: msg };
      }
    },
    [insforge, fetchOrders]
  );

  /**
   * Cancelar una orden en BORRADOR (no aplica a COMPLETADA).
   */
  const cancelOrder = useCallback(
    async (orderId: string) => {
      try {
        const target = orders.find((o) => o.id === orderId);
        if (target?.status === "COMPLETADA") {
          return { error: "No se puede cancelar una orden ya completada." };
        }
        const { error: upErr } = await insforge.database
          .from("unified_production_orders")
          .update({ status: "CANCELADA" })
          .eq("id", orderId);

        if (upErr) throw upErr;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Error al cancelar orden" };
      }
    },
    [insforge, fetchOrders, orders]
  );

  return { orders, loading, error, createOrder, updateWaste, executeOrder, cancelOrder, refetch: fetchOrders };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook: presentaciones de una orden
// ──────────────────────────────────────────────────────────────────────────────

export function useUnifiedPresentations(orderId: string | null) {
  const insforge = getInsforge();
  const [presentations, setPresentations] = useState<UnifiedPresentation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresentations = useCallback(async () => {
    if (!orderId) { setPresentations([]); return; }
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("unified_production_presentations")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");

      setPresentations((data as UnifiedPresentation[]) ?? []);
    } catch {
      setPresentations([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchPresentations(); }, [fetchPresentations]);

  const upsertPresentation = useCallback(
    async (payload: CreateUnifiedPresentation) => {
      try {
        const { error: upsErr } = await insforge.database
          .from("unified_production_presentations")
          .upsert([payload], { onConflict: "order_id,product_id" });

        if (upsErr) throw upsErr;
        await fetchPresentations();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Error al guardar presentación" };
      }
    },
    [insforge, fetchPresentations]
  );

  const deletePresentation = useCallback(
    async (presentationId: string) => {
      try {
        const { error: delErr } = await insforge.database
          .from("unified_production_presentations")
          .delete()
          .eq("id", presentationId);

        if (delErr) throw delErr;
        await fetchPresentations();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Error al eliminar presentación" };
      }
    },
    [insforge, fetchPresentations]
  );

  /** Reemplaza todas las presentaciones de la orden (bulk upsert) */
  const syncPresentations = useCallback(
    async (orderId: string, rows: CreateUnifiedPresentation[]) => {
      try {
        // Eliminar las existentes primero
        const { error: delErr } = await insforge.database
          .from("unified_production_presentations")
          .delete()
          .eq("order_id", orderId);

        if (delErr) throw delErr;

        if (rows.length > 0) {
          const { error: insErr } = await insforge.database
            .from("unified_production_presentations")
            .insert(rows);

          if (insErr) throw insErr;
        }

        await fetchPresentations();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Error al sincronizar presentaciones" };
      }
    },
    [insforge, fetchPresentations]
  );

  return { presentations, loading, upsertPresentation, deletePresentation, syncPresentations, refetch: fetchPresentations };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook: datos del formulario de nueva orden (receta + ingredientes + stock)
// ──────────────────────────────────────────────────────────────────────────────

interface StockRow {
  product_id: string;
  stock_actual: number;
  unit: string;
  name: string;
  sku: string;
  cost_per_unit: number;
}

export interface UnifiedIngredientRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  percentage: number;      // de la receta
  required_kg: number;     // (percentage / 100) × batch_kg
  required_qty: number;    // en stock_unit
  stock_unit: string;
  stock_available: number; // en stock_unit
  stock_sufficient: boolean;
  ingredient_role: "MATERIA_PRIMA" | "INSUMO";
}

export function useUnifiedIngredients(recipeId: string | null, batchKg: number) {
  const insforge = getInsforge();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [rawIngredients, setRawIngredients] = useState<RecipeIngredient[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, StockRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRecipe(null);
      setRawIngredients([]);
      setStockMap({});
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const { data: recData, error: recErr } = await insforge.database
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();
        if (recErr) throw recErr;

        const { data: ingData, error: ingErr } = await insforge.database
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", recipeId);
        if (ingErr) throw ingErr;

        const ingredients = (ingData as RecipeIngredient[]) ?? [];
        const productIds = ingredients.map((i) => i.product_id);

        let map: Record<string, StockRow> = {};
        if (productIds.length > 0) {
          const [{ data: stockData }, { data: costData }] = await Promise.all([
            insforge.database.from("stock_summary").select("*").in("product_id", productIds),
            insforge.database.from("products").select("id, cost_per_unit").in("id", productIds),
          ]);

          const costMap: Record<string, number> = {};
          ((costData as { id: string; cost_per_unit: number }[]) ?? []).forEach((c) => {
            costMap[c.id] = c.cost_per_unit ?? 0;
          });

          (
            stockData as { product_id: string; stock_actual: number; unit: string; name: string; sku: string }[]
          ).forEach((s) => {
            map[s.product_id] = { ...s, cost_per_unit: costMap[s.product_id] ?? 0 };
          });
        }

        if (mounted) {
          setRecipe(recData as Recipe);
          setRawIngredients(ingredients);
          setStockMap(map);
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Error cargando ingredientes");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [recipeId, insforge]);

  /** Ingredientes calculados para el batch_kg actual */
  const ingredientRows = useMemo<UnifiedIngredientRow[]>(() => {
    if (!recipe || rawIngredients.length === 0 || batchKg <= 0) return [];

    return rawIngredients
      .filter((ing) => ing.percentage != null)
      .map((ing) => {
        const pct     = ing.percentage!;
        const reqKg   = (pct / 100) * batchKg;
        const stock   = stockMap[ing.product_id];
        const stockUnit = stock?.unit ?? ing.unit;

        // convert required_kg → stock_unit
        const kgFactor = unitToKgFactor(stockUnit);
        const reqQty   = reqKg / kgFactor;

        const stockAvail = stock?.stock_actual ?? 0;

        return {
          id:                ing.id,
          product_id:        ing.product_id,
          product_name:      stock?.name ?? ing.product_id,
          product_sku:       stock?.sku  ?? "",
          percentage:        pct,
          required_kg:       reqKg,
          required_qty:      reqQty,
          stock_unit:        stockUnit,
          stock_available:   stockAvail,
          stock_sufficient:  stockAvail >= reqQty,
          ingredient_role:   ing.ingredient_role as "MATERIA_PRIMA" | "INSUMO",
        };
      });
  }, [recipe, rawIngredients, stockMap, batchKg]);

  /** % suma validación */
  const percentageSum = useMemo(
    () => rawIngredients.reduce((acc, i) => acc + (i.percentage ?? 0), 0),
    [rawIngredients]
  );

  const allStockSufficient = ingredientRows.every((r) => r.stock_sufficient);
  const hasPercentages     = rawIngredients.some((i) => i.percentage != null && i.percentage > 0);

  return {
    recipe,
    ingredientRows,
    percentageSum,
    allStockSufficient,
    hasPercentages,
    loading,
    error,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook: productos PRODUCTO_TERMINADO para el selector de presentaciones
// ──────────────────────────────────────────────────────────────────────────────

export interface FinishedProduct {
  id: string;
  name: string;
  sku: string;
  /**
   * Gramos/kg que representa UNA unidad comercial de este producto.
   * Viene de packaging_templates.bulk_qty_per_unit convertido a kg.
   * NOTA: products.capacity es NULL para PRODUCTO_TERMINADO (el schema lo bloquea).
   *       La única fuente de conversión es la plantilla de empaque activa.
   */
  capacity_kg: number;
  /** Nombre de unidad comercial legible (ej. "200g", "paquete") */
  sales_unit_name: string;
  /** ID del packaging_template que define esta conversión */
  template_id: string | null;
}

export function useFinishedProducts() {
  const insforge = getInsforge();
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // 1. All PRODUCTO_TERMINADO (active)
        const { data: prods } = await insforge.database
          .from("products")
          .select("id, name, sku, sales_unit_name")
          .eq("type", "PRODUCTO_TERMINADO")
          .eq("is_active", true)
          .order("name");

        const prodList = (
          prods as { id: string; name: string; sku: string; sales_unit_name: string }[]
        ) ?? [];

        if (prodList.length === 0) {
          if (mounted) { setProducts([]); setLoading(false); }
          return;
        }

        const productIds = prodList.map((p) => p.id);

        // 2. Fetch packaging_templates for these products.
        //    output_product_id links a PRODUCTO_TERMINADO to its template.
        //    bulk_qty_per_unit + bulk_unit define the mass per commercial unit.
        const { data: templates } = await insforge.database
          .from("packaging_templates")
          .select("id, output_product_id, bulk_qty_per_unit, bulk_unit")
          .in("output_product_id", productIds)
          .eq("is_active", true);

        const tplList = (
          templates as {
            id: string;
            output_product_id: string;
            bulk_qty_per_unit: number;
            bulk_unit: string;
          }[]
        ) ?? [];

        // Build a map: product_id → first active template found
        const tplMap: Record<string, typeof tplList[0]> = {};
        for (const t of tplList) {
          if (!tplMap[t.output_product_id]) tplMap[t.output_product_id] = t;
        }

        const mapped: FinishedProduct[] = prodList
          .map((p) => {
            const tpl = tplMap[p.id] ?? null;
            const capacity_kg = tpl
              ? tpl.bulk_qty_per_unit * unitToKgFactor(tpl.bulk_unit)
              : 0;
            return {
              id:              p.id,
              name:            p.name,
              sku:             p.sku,
              capacity_kg,
              sales_unit_name: p.sales_unit_name ?? "unidad",
              template_id:     tpl?.id ?? null,
            };
          })
          // Only products with a linked template can be used in mass balance
          .filter((p) => p.capacity_kg > 0);

        if (mounted) setProducts(mapped);
      } catch {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [insforge]);

  return { products, loading };
}

