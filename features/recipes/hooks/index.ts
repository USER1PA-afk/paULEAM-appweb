"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { Recipe, RecipeIngredient, InstructionStep } from "@entities/recipe";
import { Product } from "@entities/product";

/**
 * Hook para obtener todas las recetas activas.
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
 * Hook para obtener una receta individual con sus ingredientes y producto de salida.
 */
export function useRecipe(recipeId: string | null) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [outputProduct, setOutputProduct] = useState<Product | null>(null);
  const [ingredientProducts, setIngredientProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchRecipe = useCallback(async () => {
    if (!recipeId) {
      setRecipe(null);
      setIngredients([]);
      setOutputProduct(null);
      setIngredientProducts({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Cargar receta
      const { data: recData, error: recErr } = await insforge.database
        .from("recipes")
        .select("*")
        .eq("id", recipeId)
        .single();

      if (recErr) throw recErr;
      const recipeData = recData as Recipe;

      // Parsear instructions si viene como string
      if (typeof recipeData.instructions === "string") {
        try {
          recipeData.instructions = JSON.parse(recipeData.instructions);
        } catch {
          recipeData.instructions = [];
        }
      }

      // Cargar ingredientes
      const { data: ingData, error: ingErr } = await insforge.database
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipeId);

      if (ingErr) throw ingErr;
      const ingredientsData = (ingData as RecipeIngredient[]) ?? [];

      // Cargar producto de salida
      const { data: outProd } = await insforge.database
        .from("products")
        .select("*")
        .eq("id", recipeData.output_product_id)
        .single();

      // Cargar productos de ingredientes
      const productIds = ingredientsData.map((i) => i.product_id);
      const prodMap: Record<string, Product> = {};

      if (productIds.length > 0) {
        const { data: prodsData } = await insforge.database
          .from("products")
          .select("*")
          .in("id", productIds);

        (prodsData as Product[] ?? []).forEach((p) => {
          prodMap[p.id] = p;
        });
      }

      setRecipe(recipeData);
      setIngredients(ingredientsData);
      setOutputProduct((outProd as Product) ?? null);
      setIngredientProducts(prodMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar receta");
    } finally {
      setLoading(false);
    }
  }, [recipeId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRecipe(); }, [fetchRecipe]);

  return { recipe, ingredients, outputProduct, ingredientProducts, loading, error, refetch: fetchRecipe };
}

/**
 * Hook para obtener los ingredientes de una receta.
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
 * Hook para obtener productos (para dropdowns de formulario).
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("products")
        .select("id, name, sku, type, unit")
        .eq("is_active", true)
        .order("name");
      setProducts((data as Product[]) ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const rawMaterials = products.filter((p) => p.type === "MATERIA_PRIMA");
  const supplies = products.filter((p) => p.type === "INSUMO");
  const finishedProducts = products.filter((p) => p.type === "PRODUCTO_TERMINADO");
  // Productos válidos como ingredientes de receta
  const ingredientProducts = products.filter(
    (p) => p.type === "MATERIA_PRIMA" || p.type === "INSUMO"
  );

  return { products, rawMaterials, supplies, ingredientProducts, finishedProducts, loading, refetch: fetchProducts };
}

/**
 * Hook para mutaciones de recetas: crear, actualizar, eliminar recetas e ingredientes.
 */
export function useRecipeMutations() {
  const insforge = getInsforge();

  /** Crear nueva receta */
  const createRecipe = useCallback(
    async (data: {
      name: string;
      output_product_id: string;
      yield_base: number;
      yield_unit: string;
      description?: string | null;
      instructions?: InstructionStep[];
      notes?: string | null;
      is_active?: boolean;
    }) => {
      const { data: result, error } = await insforge.database
        .from("recipes")
        .insert({
          name: data.name,
          output_product_id: data.output_product_id,
          yield_base: data.yield_base,
          yield_unit: data.yield_unit,
          description: data.description || null,
          instructions: data.instructions ?? [],
          notes: data.notes || null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw new Error(error.details ? `${error.message}: ${error.details}` : error.message || "Error al crear la receta");
      return result as Recipe;
    },
    [insforge]
  );

  /** Actualizar receta existente */
  const updateRecipe = useCallback(
    async (
      recipeId: string,
      data: {
        name?: string;
        output_product_id?: string;
        yield_base?: number;
        yield_unit?: string;
        description?: string | null;
        instructions?: InstructionStep[];
        notes?: string | null;
      }
    ) => {
      const updatePayload: Record<string, unknown> = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.output_product_id !== undefined) updatePayload.output_product_id = data.output_product_id;
      if (data.yield_base !== undefined) updatePayload.yield_base = data.yield_base;
      if (data.yield_unit !== undefined) updatePayload.yield_unit = data.yield_unit;
      if (data.description !== undefined) updatePayload.description = data.description || null;
      if (data.instructions !== undefined) updatePayload.instructions = data.instructions;
      if (data.notes !== undefined) updatePayload.notes = data.notes || null;

      const { error } = await insforge.database
        .from("recipes")
        .update(updatePayload)
        .eq("id", recipeId);

      if (error) throw new Error(error.details ? `${error.message}: ${error.details}` : error.message || "Error al actualizar la receta");
    },
    [insforge]
  );

  /** Agregar ingrediente a una receta */
  const addIngredient = useCallback(
    async (data: {
      recipe_id: string;
      product_id: string;
      quantity: number;
      unit: string;
      ingredient_role?: "MATERIA_PRIMA" | "INSUMO";
      notes?: string | null;
    }) => {
      const { error } = await insforge.database
        .from("recipe_ingredients")
        .insert({ ingredient_role: "MATERIA_PRIMA", ...data });

      if (error) throw new Error(error.details ? `${error.message}: ${error.details}` : error.message || "Error al agregar ingrediente");
    },
    [insforge]
  );

  /** Eliminar ingrediente */
  const removeIngredient = useCallback(
    async (ingredientId: string) => {
      const { error } = await insforge.database
        .from("recipe_ingredients")
        .delete()
        .eq("id", ingredientId);

      if (error) throw new Error(error.details ? `${error.message}: ${error.details}` : error.message || "Error al eliminar ingrediente");
    },
    [insforge]
  );

  /** Reemplazar todos los ingredientes de una receta (borrar y reinsertar) */
  const replaceIngredients = useCallback(
    async (recipeId: string, ingredients: {
      product_id: string;
      quantity: number;
      unit: string;
      ingredient_role?: "MATERIA_PRIMA" | "INSUMO";
      notes?: string | null;
    }[]) => {
      // Eliminar existentes
      const { error: delErr } = await insforge.database
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", recipeId);

      if (delErr) throw new Error(delErr.details ? `${delErr.message}: ${delErr.details}` : delErr.message || "Error al limpiar ingredientes anteriores");

      // Insertar nuevos
      if (ingredients.length > 0) {
        const rows = ingredients.map((ing) => ({
          recipe_id: recipeId,
          product_id: ing.product_id,
          quantity: ing.quantity,
          unit: ing.unit,
          ingredient_role: ing.ingredient_role ?? "MATERIA_PRIMA",
          notes: ing.notes ?? null,
        }));

        const { error: insErr } = await insforge.database
          .from("recipe_ingredients")
          .insert(rows);

        if (insErr) throw new Error(insErr.details ? `${insErr.message}: ${insErr.details}` : insErr.message || "Error al insertar nuevos ingredientes");
      }
    },
    [insforge]
  );

  return { createRecipe, updateRecipe, addIngredient, removeIngredient, replaceIngredients };
}
