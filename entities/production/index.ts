import { z } from "zod";

/**
 * Entity: ProductionOrder
 *
 * Orden de producción que referencia una receta y un rendimiento objetivo.
 * El trigger PL/pgSQL se activa al cambiar el estado a COMPLETADA,
 * ejecutando el motor de escalado atómico.
 */

export const ProductionStatusEnum = z.enum([
  "BORRADOR",
  "EN_PROCESO",
  "COMPLETADA",
  "CANCELADA",
]);
export type ProductionStatus = z.infer<typeof ProductionStatusEnum>;

export const ProductionOrderSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  target_yield: z.number().positive("El rendimiento objetivo debe ser positivo"),
  status: ProductionStatusEnum,
  notes: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ProductionOrder = z.infer<typeof ProductionOrderSchema>;

/** Schema para crear una orden de producción (formulario) */
export const CreateProductionOrderSchema = ProductionOrderSchema.omit({
  id: true,
  status: true,
  completed_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
});

export type CreateProductionOrder = z.infer<typeof CreateProductionOrderSchema>;

/**
 * Ingrediente escalado — tipo derivado para el preview de producción.
 * Extiende la información del ingrediente con datos de escalado y stock.
 */
export interface ScaledIngredient {
  /** ID del ingrediente de receta */
  id: string;
  /** ID del producto (materia prima) */
  product_id: string;
  /** Nombre del producto */
  product_name: string;
  /** SKU del producto */
  product_sku: string;
  /** Cantidad base de la receta */
  base_quantity: number;
  /** Unidad del ingrediente en la receta */
  unit: string;
  /** Unidad del producto en inventario */
  inventory_unit: string;
  /** Cantidad escalada según factor */
  scaled_quantity: number;
  /** Stock disponible actual */
  stock_available: number;
  /** Si el stock es suficiente para cubrir la cantidad escalada */
  stock_sufficient: boolean;
  /** Si la unidad de receta difiere de la unidad de inventario */
  unit_mismatch: boolean;
}
