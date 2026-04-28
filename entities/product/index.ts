import { z } from "zod";

/**
 * Entity: Product
 *
 * Producto de la planta de alimentos.
 * Puede ser materia prima o producto terminado.
 */

export const ProductTypeEnum = z.enum(["MATERIA_PRIMA", "PRODUCTO_TERMINADO"]);
export type ProductType = z.infer<typeof ProductTypeEnum>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  type: ProductTypeEnum,
  unit: z.string().min(1, "La unidad de medida es requerida"), // kg, lt, unidades
  description: z.string().optional(),
  price: z.number().nonnegative().optional(), // Solo para productos terminados (e-commerce)
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateProduct = z.infer<typeof CreateProductSchema>;
