import { z } from "zod";

// ============================
// Product Type Enum (6 categorías)
// ============================
export const ProductTypeEnum = z.enum([
  "MATERIA_PRIMA",         // Ingredientes principales: leche, harina, sal
  "INSUMO",                // Auxiliares: cuajo, conservantes, etiquetas
  "ENVASE_EMPAQUE",        // Envases y embalajes: bolsas, botellas, tapas
  "PRODUCTO_A_GRANEL",     // Resultado de producción (ej. queso en kg). Input del empaque.
  "PRODUCTO_TERMINADO",    // Presentación final envasada, lista para vender al cliente.
  "MATERIAL_SECUNDARIO",   // Etiquetas, cajas, suministros y materiales de apoyo
]);
export type ProductType = z.infer<typeof ProductTypeEnum>;

/**
 * Etiquetas en español para cada tipo de producto.
 */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  MATERIA_PRIMA:        "Materia Prima",
  INSUMO:               "Insumo / Auxiliar",
  ENVASE_EMPAQUE:       "Envase / Empaque",
  PRODUCTO_A_GRANEL:    "Producto a Granel",
  PRODUCTO_TERMINADO:   "Producto Terminado",
  MATERIAL_SECUNDARIO:  "Material Secundario / Otro",
};

/**
 * Color de badge por tipo (clases Tailwind).
 */
export const PRODUCT_TYPE_COLORS: Record<ProductType, string> = {
  MATERIA_PRIMA:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  INSUMO:              "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ENVASE_EMPAQUE:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PRODUCTO_A_GRANEL:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  PRODUCTO_TERMINADO:  "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  MATERIAL_SECUNDARIO: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

/**
 * Tipos que pueden tener proveedores (se compran externamente).
 */
export const PURCHASABLE_TYPES: ProductType[] = [
  "MATERIA_PRIMA",
  "INSUMO",
  "ENVASE_EMPAQUE",
  "MATERIAL_SECUNDARIO",
];

/**
 * Tipos que pueden aparecer como ingredientes en recetas.
 */
export const INGREDIENT_TYPES: ProductType[] = [
  "MATERIA_PRIMA",
  "INSUMO",
];

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
  conversion_factor: z.number().default(1.0).optional(),
  sales_unit_name: z.string().nullable().optional(),
  min_stock_alert: z.number().nonnegative().nullable().optional(),
  cost_per_unit: z.number().nonnegative().default(0).optional(),
  capacity: z.number().positive().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).superRefine((data, ctx) => {
  // Granel / Terminado: cost auto-calculated by trigger — reject manual non-zero value
  if (
    (data.type === "PRODUCTO_A_GRANEL" || data.type === "PRODUCTO_TERMINADO") &&
    data.cost_per_unit != null &&
    data.cost_per_unit > 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cost_per_unit"],
      message: "El costo se calcula automáticamente para este tipo de producto.",
    });
  }
  // Granel / Terminado: capacity field must not be provided
  if (
    (data.type === "PRODUCTO_A_GRANEL" || data.type === "PRODUCTO_TERMINADO") &&
    data.capacity != null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacity"],
      message: "Los productos a granel y terminados no tienen capacidad de envase.",
    });
  }
  // ENVASE_EMPAQUE: capacity required and must be positive
  if (data.type === "ENVASE_EMPAQUE") {
    if (data.capacity == null || data.capacity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capacity"],
        message: "La capacidad del envase es obligatoria.",
      });
    }
  }
  // MATERIA_PRIMA / INSUMO / MATERIAL_SECUNDARIO: capacity must not be set
  if (
    (data.type === "MATERIA_PRIMA" || data.type === "INSUMO" || data.type === "MATERIAL_SECUNDARIO") &&
    data.capacity != null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacity"],
      message: "Este tipo de material no admite capacidad de envase.",
    });
  }
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
