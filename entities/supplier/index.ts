import { z } from "zod";

/**
 * Entity: Supplier (Proveedor)
 *
 * Entidad externa — NO es usuario del sistema (sin auth.users).
 * Solo aplica como proveedor de MATERIA_PRIMA.
 */

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "El nombre es requerido"),
  company: z.string().optional(),
  ruc: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Supplier = z.infer<typeof SupplierSchema>;

export const CreateSupplierSchema = SupplierSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;

/**
 * Entity: ProductSupplier (Relación N:M Producto ↔ Proveedor)
 *
 * is_primary = TRUE → proveedor preferido para este producto.
 * Solo puede haber uno por producto (enforced por DB unique index).
 */
export const ProductSupplierSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  is_primary: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
});

export type ProductSupplier = z.infer<typeof ProductSupplierSchema>;

export const CreateProductSupplierSchema = ProductSupplierSchema.omit({
  id: true,
  created_at: true,
});

export type CreateProductSupplier = z.infer<typeof CreateProductSupplierSchema>;
