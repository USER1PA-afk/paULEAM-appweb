import { z } from "zod";

export const ProductTypeEnum = z.enum(["MATERIA_PRIMA", "PRODUCTO_TERMINADO"]);
export type ProductType = z.infer<typeof ProductTypeEnum>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  type: ProductTypeEnum,
  unit: z.string().min(1, "La unidad de medida es requerida"),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  long_description: z.string().nullable().optional(),
  specifications: z.record(z.string(), z.unknown()).default({}),
  ingredients: z.string().nullable().optional(),
  nutritional_info: z.record(z.string(), z.unknown()).default({}),
  weight: z.number().positive().nullable().optional(),
  commercial_details: z.string().nullable().optional(),
  price: z.number().nonnegative().optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  featured: z.boolean().default(false),
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

export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  storage_path: z.string(),
  alt_text: z.string().nullable().optional(),
  position: z.number().int(),
  is_primary: z.boolean(),
  created_at: z.string().datetime().optional(),
});

export type ProductImage = z.infer<typeof ProductImageSchema>;
