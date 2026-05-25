import { z } from "zod";

/**
 * Entity: Packaging
 *
 * Módulo de empaque post-producción.
 *
 * Flujo:
 *   Producto terminado a granel →
 *   Plantilla de empaque (define presentación + materiales) →
 *   Orden de empaque →
 *   Trigger atómico:
 *     EGRESO granel + EGRESO materiales + INGRESO producto empacado
 */

// ============================
// Packaging Status Enum
// ============================
export const PackagingStatusEnum = z.enum([
  "BORRADOR",
  "EN_PROCESO",
  "COMPLETADA",
  "CANCELADA",
]);
export type PackagingStatus = z.infer<typeof PackagingStatusEnum>;

export const PACKAGING_STATUS_LABELS: Record<PackagingStatus, string> = {
  BORRADOR:   "Borrador",
  EN_PROCESO: "En Proceso",
  COMPLETADA: "Completada",
  CANCELADA:  "Cancelada",
};

export const PACKAGING_STATUS_COLORS: Record<PackagingStatus, string> = {
  BORRADOR:   "bg-gray-400",
  EN_PROCESO: "bg-blue-500",
  COMPLETADA: "bg-accent-500",
  CANCELADA:  "bg-red-500",
};

// ============================
// Template Material Schema
// ============================
export const PackagingTemplateMaterialSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  /** Debe ser un producto de tipo ENVASE_EMPAQUE */
  material_product_id: z.string().uuid(),
  quantity_per_unit: z.number().positive("La cantidad por unidad debe ser positiva"),
  unit: z.string().min(1),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
  // Join: nombre del producto material (populated in hooks)
  material_name: z.string().optional(),
  material_sku: z.string().optional(),
});

export type PackagingTemplateMaterial = z.infer<typeof PackagingTemplateMaterialSchema>;

export const CreatePackagingTemplateMaterialSchema = PackagingTemplateMaterialSchema.omit({
  id: true,
  created_at: true,
  material_name: true,
  material_sku: true,
});

export type CreatePackagingTemplateMaterial = z.infer<typeof CreatePackagingTemplateMaterialSchema>;

// ============================
// Packaging Template Schema
// ============================
export const PackagingTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre de la plantilla es requerido"),
  /** Producto terminado a granel que se empaca */
  finished_product_id: z.string().uuid(),
  /**
   * Producto que se genera al empacar.
   * Puede ser igual a finished_product_id (mismo SKU, solo se consume empaque)
   * o diferente (nueva presentación con nuevo SKU).
   */
  output_product_id: z.string().uuid(),
  /** Cuánto producto a granel consume una unidad empacada (ej: 0.5 kg) */
  bulk_qty_per_unit: z.number().positive("La cantidad por unidad debe ser positiva"),
  bulk_unit: z.string().min(1),
  output_unit: z.string().min(1),
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  materials: z.array(PackagingTemplateMaterialSchema).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  // Join fields populated in hooks
  finished_product_name: z.string().optional(),
  finished_product_sku: z.string().optional(),
  output_product_name: z.string().optional(),
  output_product_sku: z.string().optional(),
});

export type PackagingTemplate = z.infer<typeof PackagingTemplateSchema>;

export const CreatePackagingTemplateSchema = PackagingTemplateSchema.omit({
  id: true,
  materials: true,
  created_at: true,
  updated_at: true,
  finished_product_name: true,
  finished_product_sku: true,
  output_product_name: true,
  output_product_sku: true,
});

export type CreatePackagingTemplate = z.infer<typeof CreatePackagingTemplateSchema>;

// ============================
// Packaging Order Schema
// ============================
export const PackagingOrderSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  /** Orden de producción de origen (opcional — para trazabilidad) */
  production_order_id: z.string().uuid().nullable().optional(),
  units_to_package: z.number().positive("Las unidades a empacar deben ser positivas"),
  /** Calculado por el trigger: units_to_package × bulk_qty_per_unit */
  bulk_quantity_consumed: z.number().nonnegative().nullable().optional(),
  status: PackagingStatusEnum,
  /** Auto-generado si se omite: EMP-YYYY-NNNN */
  batch_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  // Join fields populated in hooks
  template_name: z.string().optional(),
  finished_product_name: z.string().optional(),
  output_product_name: z.string().optional(),
});

export type PackagingOrder = z.infer<typeof PackagingOrderSchema>;

export const CreatePackagingOrderSchema = PackagingOrderSchema.omit({
  id: true,
  status: true,
  bulk_quantity_consumed: true,
  completed_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  template_name: true,
  finished_product_name: true,
  output_product_name: true,
});

export type CreatePackagingOrder = z.infer<typeof CreatePackagingOrderSchema>;

// ============================
// Preview types
// ============================

/** Resumen de materiales necesarios para una orden de empaque */
export interface PackagingMaterialPreview {
  material_product_id: string;
  material_name: string;
  material_sku: string;
  quantity_needed: number;
  unit: string;
  stock_available: number;
  stock_sufficient: boolean;
}

/** Preview completo antes de crear/completar una orden de empaque */
export interface PackagingOrderPreview {
  template: PackagingTemplate;
  units_to_package: number;
  bulk_qty_consumed: number;
  bulk_stock_available: number;
  bulk_stock_sufficient: boolean;
  materials: PackagingMaterialPreview[];
  can_package: boolean;
}
