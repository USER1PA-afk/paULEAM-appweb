import { z } from "zod";

/**
 * Entity: Recipe
 *
 * Receta de producción con ingredientes y rendimiento base.
 * El motor de escalado usa rendimiento_base para calcular el factor.
 */

export const RecipeIngredientSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  product_id: z.string().uuid(), // Materia prima
  quantity: z.number().positive("La cantidad debe ser positiva"),
  unit: z.string().min(1),
  is_optional: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

/** Schema para crear un ingrediente de receta (formulario) */
export const CreateRecipeIngredientSchema = RecipeIngredientSchema.omit({
  id: true,
  created_at: true,
});

export type CreateRecipeIngredient = z.infer<typeof CreateRecipeIngredientSchema>;

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre de la receta es requerido"),
  output_product_id: z.string().uuid(), // Producto terminado que genera
  yield_base: z.number().positive("El rendimiento base debe ser positivo"), // Cantidad base que produce
  yield_unit: z.string().min(1),
  description: z.string().nullable().optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

/** Schema para crear una receta (formulario) */
export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  ingredients: true,
  created_at: true,
  updated_at: true,
});

export type CreateRecipe = z.infer<typeof CreateRecipeSchema>;
