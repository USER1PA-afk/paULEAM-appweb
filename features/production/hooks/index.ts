"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

interface ProductionOrder {
  id: string;
  recipe_id: string;
  target_yield: number;
  status: "BORRADOR" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";
  notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Recipe {
  id: string;
  name: string;
  output_product_id: string;
  yield_base: number;
  yield_unit: string;
  description: string | null;
  is_active: boolean;
}

interface RecipeIngredient {
  id: string;
  recipe_id: string;
  product_id: string;
  quantity: number;
  unit: string;
}

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = useCallback(
    async (order: {
      recipe_id: string;
      target_yield: number;
      notes?: string;
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
        const { data, error: updateError } = await insforge.database
          .from("production_orders")
          .update({ status: "COMPLETADA" })
          .eq("id", orderId)
          .select();

        if (updateError) throw updateError;
        await fetchOrders();
        return { data, error: null };
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
    async (orderId: string, status: ProductionOrder["status"]) => {
      try {
        const { data, error: updateError } = await insforge.database
          .from("production_orders")
          .update({ status })
          .eq("id", orderId)
          .select();

        if (updateError) throw updateError;
        await fetchOrders();
        return { data, error: null };
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

  return {
    orders,
    loading,
    error,
    createOrder,
    completeOrder,
    updateStatus,
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

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return { recipes, loading, refetch: fetchRecipes };
}

/**
 * Hook para obtener los ingredientes de una receta específica.
 */
export function useRecipeIngredients(recipeId: string | null) {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  useEffect(() => {
    if (!recipeId) {
      setIngredients([]);
      return;
    }

    setLoading(true);
    insforge.database
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .then(
        ({ data }) => {
          setIngredients((data as RecipeIngredient[]) ?? []);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
  }, [recipeId, insforge]);

  return { ingredients, loading };
}

/**
 * Calcula el factor de escala y las cantidades escaladas de ingredientes.
 */
export function useRecipeScale(
  yieldBase: number,
  targetYield: number,
  ingredients: RecipeIngredient[]
) {
  const scaleFactor = yieldBase > 0 ? targetYield / yieldBase : 0;

  const scaledIngredients = ingredients.map((ing) => ({
    ...ing,
    scaledQuantity: Number((ing.quantity * scaleFactor).toFixed(4)),
  }));

  return { scaleFactor, scaledIngredients };
}
