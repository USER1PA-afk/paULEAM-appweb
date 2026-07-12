import { z } from "zod";

/**
 * Entity: Recipe
 *
 * Receta de producción con ingredientes, rendimiento base e instrucciones.
 * El motor de escalado usa yield_base para calcular el factor de escala.
 */

// ============================
// Ingredient Role
// ============================
export const IngredientRoleEnum = z.enum(["MATERIA_PRIMA", "INSUMO"]);
export type IngredientRole = z.infer<typeof IngredientRoleEnum>;

export const INGREDIENT_ROLE_LABELS: Record<IngredientRole, string> = {
  MATERIA_PRIMA: "Materia Prima",
  INSUMO:        "Insumo / Auxiliar",
};

// ============================
// Ingredient Schema
// ============================
export const RecipeIngredientSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive("La cantidad debe ser positiva"),
  unit: z.string().min(1),
  /** Rol del ingrediente en la receta: MATERIA_PRIMA o INSUMO */
  ingredient_role: IngredientRoleEnum.default("MATERIA_PRIMA"),
  /** Notas de preparación específicas para este ingrediente */
  notes: z.string().nullable().optional(),
  /**
   * Porcentaje del ingrediente respecto al yield_base de la receta.
   * Backfilleado por migración: percentage = (quantity / yield_base) × 100.
   * Nulo para filas legacy donde yield_base = 0.
   */
  percentage: z.number().nullable().optional(),
  created_at: z.string().datetime().optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const CreateRecipeIngredientSchema = RecipeIngredientSchema.omit({
  id: true,
  created_at: true,
});

export type CreateRecipeIngredient = z.infer<typeof CreateRecipeIngredientSchema>;

// ============================
// Instruction Step Schema
// ============================
export const InstructionStepSchema = z.object({
  step: z.number().int().positive(),
  description: z.string().min(1, "La descripción del paso es requerida"),
  temperature: z.string().optional(),
  duration: z.string().optional(),
});

export type InstructionStep = z.infer<typeof InstructionStepSchema>;

// ============================
// Recipe Schema
// ============================
export const RecipeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre de la receta es requerido"),
  output_product_id: z.string().uuid(),
  yield_base: z.number().positive("El rendimiento base debe ser positivo"),
  yield_unit: z.string().min(1),
  description: z.string().nullable().optional(),
  instructions: z.array(InstructionStepSchema).default([]),
  notes: z.string().nullable().optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  ingredients: true,
  created_at: true,
  updated_at: true,
});

export type CreateRecipe = z.infer<typeof CreateRecipeSchema>;
