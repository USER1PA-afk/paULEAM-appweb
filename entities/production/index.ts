import { z } from "zod";

/**
 * Entity: ProductionOrder
 *
 * Orden de producción que referencia una receta y un rendimiento objetivo.
 * Al cambiar el estado a COMPLETADA, el trigger PL/pgSQL ejecuta el motor
 * de escalado atómico:
 *   - Escala ingredientes por (target_yield / yield_base)
 *   - Descuenta stock de cada ingrediente
 *   - Inyecta el producto terminado al inventario
 *   - Calcula el costo total de producción
 */

export const ProductionStatusEnum = z.enum([
  "BORRADOR",
  "EN_PROCESO",
  "COMPLETADA",
  "CANCELADA",
]);
export type ProductionStatus = z.infer<typeof ProductionStatusEnum>;

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  BORRADOR:   "Borrador",
  EN_PROCESO: "En Proceso",
  COMPLETADA: "Completada",
  CANCELADA:  "Cancelada",
};

export const PRODUCTION_STATUS_COLORS: Record<ProductionStatus, string> = {
  BORRADOR:   "bg-gray-400",
  EN_PROCESO: "bg-blue-500",
  COMPLETADA: "bg-accent-500",
  CANCELADA:  "bg-red-500",
};

export const ProductionOrderSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  target_yield: z.number().positive("El rendimiento objetivo debe ser positivo"),
  status: ProductionStatusEnum,
  /** Número de lote (auto-generado si se omite: PROD-YYYY-NNNN) */
  batch_number: z.string().nullable().optional(),
  /** Fecha planificada de producción */
  scheduled_date: z.string().nullable().optional(),
  /** Rendimiento real (puede diferir del objetivo por merma) */
  actual_yield: z.number().positive().nullable().optional(),
  /** Merma declarada después de completar */
  waste_quantity: z.number().nonnegative().default(0).optional(),
  /** Costo total calculado al completar (suma de ingredientes × cost_per_unit) */
  production_cost: z.number().nonnegative().default(0).optional(),
  notes: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ProductionOrder = z.infer<typeof ProductionOrderSchema>;

export const CreateProductionOrderSchema = ProductionOrderSchema.omit({
  id: true,
  status: true,
  actual_yield: true,
  waste_quantity: true,
  production_cost: true,
  completed_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
});

export type CreateProductionOrder = z.infer<typeof CreateProductionOrderSchema>;

/**
 * Ingrediente escalado — tipo derivado para el preview de producción.
 * Incluye el rol del ingrediente para separar materias primas de insumos.
 */
export interface ScaledIngredient {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  /** Rol en la receta: MATERIA_PRIMA o INSUMO */
  ingredient_role: "MATERIA_PRIMA" | "INSUMO";
  base_quantity: number;
  unit: string;
  inventory_unit: string;
  scaled_quantity: number;
  stock_available: number;
  stock_sufficient: boolean;
  unit_mismatch: boolean;
  /** Costo unitario del producto (para cálculo de costo de producción) */
  cost_per_unit: number;
  /** Costo total de este ingrediente escalado */
  scaled_cost: number;
}
