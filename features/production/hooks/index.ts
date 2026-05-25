"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { ProductionOrder, ProductionStatus } from "@entities/production";
import { Recipe, RecipeIngredient } from "@entities/recipe";
import { calculateScaleFactor, scaleIngredientsWithStock, calculateTotalProductionCost } from "../lib";
import { ScaledIngredient } from "@entities/production";

/**
 * Hook para gestionar órdenes de producción.
 */
export function useProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await insforge.database
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setOrders((data as ProductionOrder[]) ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al cargar órdenes"
      );
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const createOrder = useCallback(
    async (order: {
      recipe_id: string;
      target_yield: number;
      batch_number?: string | null;
      scheduled_date?: string | null;
      notes?: string | null;
    }) => {
      try {
        const { data, error: insertError } = await insforge.database
          .from("production_orders")
          .insert({ ...order, status: "BORRADOR" })
          .select();

        if (insertError) throw insertError;
        await fetchOrders();
        return { data, error: null };
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
   * Completar orden — activa el trigger PL/pgSQL que:
   * 1. Calcula factor de escala
   * 2. Descuenta materia prima
   * 3. Inyecta producto terminado
   * Si falta stock, el trigger hace RAISE EXCEPTION → rollback automático.
   */
  const completeOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error: updateError } = await insforge.database
          .from("production_orders")
          .update({ status: "COMPLETADA" })
          .eq("id", orderId);

        if (updateError) throw updateError;
        await fetchOrders();
        return { data: null, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error:
            err instanceof Error ? err.message : "Error al completar orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  const updateStatus = useCallback(
    async (orderId: string, status: ProductionStatus) => {
      try {
        const { error: updateError } = await insforge.database
          .from("production_orders")
          .update({ status })
          .eq("id", orderId);

        if (updateError) throw updateError;
        await fetchOrders();
        return { data: null, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error:
            err instanceof Error
              ? err.message
              : "Error al actualizar estado",
        };
      }
    },
    [insforge, fetchOrders]
  );

  /**
   * Cancelar orden — solo admin. Cambia estado a CANCELADA.
   * No activa el trigger de producción (solo aplica para COMPLETADA).
   */
  const cancelOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error: updateError } = await insforge.database
          .from("production_orders")
          .update({ status: "CANCELADA" })
          .eq("id", orderId);

        if (updateError) throw updateError;
        await fetchOrders();
        return { data: null, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error:
            err instanceof Error ? err.message : "Error al cancelar orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  /**
   * Declarar merma de una orden completada.
   * Llama al RPC declare_production_waste que inserta un EGRESO MERMA.
   */
  const declareWaste = useCallback(
    async (orderId: string, wasteQty: number, notes?: string) => {
      try {
        const { error: rpcErr } = await insforge.database.rpc("declare_production_waste", {
          p_order_id: orderId,
          p_waste_qty: wasteQty,
          p_waste_notes: notes ?? null,
        });

        if (rpcErr) throw rpcErr;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al declarar merma",
        };
      }
    },
    [insforge, fetchOrders]
  );

  return {
    orders,
    loading,
    error,
    createOrder,
    completeOrder,
    updateStatus,
    cancelOrder,
    declareWaste,
    refetch: fetchOrders,
  };
}

/**
 * Hook para gestionar recetas.
 */
export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("recipes")
        .select("*")
        .eq("is_active", true)
        .order("name");

      setRecipes((data as Recipe[]) ?? []);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  return { recipes, loading, refetch: fetchRecipes };
}

/**
 * Hook para obtener los ingredientes de una receta específica.
 */
export function useRecipeIngredients(recipeId: string | null) {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  const fetchIngredients = useCallback(async () => {
    if (!recipeId) {
      setIngredients([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipeId);
      setIngredients((data as RecipeIngredient[]) ?? []);
    } catch {
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  }, [recipeId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  return { ingredients, loading, refetch: fetchIngredients };
}

/**
 * Calcula el factor de escala y las cantidades escaladas de ingredientes (Legacy).
 */
export function useRecipeScale(
  yieldBase: number,
  targetYield: number,
  ingredients: RecipeIngredient[]
) {
  const scaleFactor = calculateScaleFactor(yieldBase, targetYield);

  const scaledIngredients = ingredients.map((ing) => ({
    ...ing,
    scaledQuantity: Number((ing.quantity * scaleFactor).toFixed(4)),
  }));

  return { scaleFactor, scaledIngredients };
}

/**
 * Hook compuesto para el preview de escalado y validación de stock.
 */
export function useScalePreview(recipeId: string | null, targetYield: number) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { stock_actual: number; unit: string; name: string; sku: string; cost_per_unit: number }>>({} as Record<string, { stock_actual: number; unit: string; name: string; sku: string; cost_per_unit: number }>);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const insforge = getInsforge();

  useEffect(() => {
    if (!recipeId || targetYield <= 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRecipe(null);
      setIngredients([]);
      setStockMap({});
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    async function loadData() {
      try {
        // 1. Cargar receta
        const { data: recData, error: recErr } = await insforge.database
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();
          
        if (recErr) throw recErr;
        const recipeData = recData as Recipe;
        
        // 2. Cargar ingredientes
        const { data: ingData, error: ingErr } = await insforge.database
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", recipeId);
          
        if (ingErr) throw ingErr;
        const ingredientsData = ingData as RecipeIngredient[];

        // 3. Cargar stock solo para los ingredientes necesarios
        const productIds = ingredientsData.map(i => i.product_id);
        const map: Record<string, { stock_actual: number; unit: string; name: string; sku: string; cost_per_unit: number }> = {};

        if (productIds.length > 0) {
          const { data: stockData, error: stockErr } = await insforge.database
            .from("stock_summary")
            .select("*")
            .in("product_id", productIds);

          if (stockErr) throw stockErr;

          // Enriquecer con costo unitario
          const { data: costData } = await insforge.database
            .from("products")
            .select("id, cost_per_unit")
            .in("id", productIds);

          const costMap: Record<string, number> = {};
          ((costData as { id: string; cost_per_unit: number }[]) ?? []).forEach(c => {
            costMap[c.id] = c.cost_per_unit ?? 0;
          });

          (stockData as { product_id: string; stock_actual: number; unit: string; name: string; sku: string }[]).forEach(s => {
            map[s.product_id] = { ...s, cost_per_unit: costMap[s.product_id] ?? 0 };
          });
        }

        if (mounted) {
          setRecipe(recipeData);
          setIngredients(ingredientsData);
          setStockMap(map);
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Error cargando datos para preview");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => { mounted = false; };
  }, [recipeId, targetYield, insforge]);

  const scaleFactor = recipe ? calculateScaleFactor(recipe.yield_base, targetYield) : 0;

  const scaledIngredients: ScaledIngredient[] =
    (recipe && ingredients.length > 0)
      ? scaleIngredientsWithStock(ingredients, scaleFactor, stockMap)
      : [];

  const canProduce = scaledIngredients.every(ing => ing.stock_sufficient);
  const estimatedCost = calculateTotalProductionCost(scaledIngredients);

  return {
    recipe,
    scaleFactor,
    scaledIngredients,
    canProduce,
    estimatedCost,
    loading,
    error
  };
}
