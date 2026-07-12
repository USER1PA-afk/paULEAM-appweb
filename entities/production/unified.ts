import { z } from "zod";
import { ProductionStatusEnum } from "./index";

/**
 * Entity: UnifiedProductionOrder
 *
 * Orden del flujo unificado de producción + empaque.
 * Al llamar al RPC execute_unified_production, la transacción atómica:
 *   1. Descuenta ingredientes (percentage × batch_kg)
 *   2. Descuenta materiales de empaque por presentación
 *   3. Registra INGRESO de cada PRODUCTO_TERMINADO con WAC proporcional
 *   4. Cierra la orden con batch_number PROD-YYYY-NNNN
 */
export const UnifiedProductionOrderSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  /** Masa total del lote en la unidad base de la receta (kg) */
  batch_kg: z.number().positive("El batch_kg debe ser positivo"),
  status: ProductionStatusEnum,
  /** Generado al completar: PROD-YYYY-NNNN */
  batch_number: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  /** batch_kg − waste_kg, calculado al completar */
  actual_batch_kg: z.number().nonnegative().nullable().optional(),
  /** Costo total MP + insumos (sin materiales de empaque) */
  production_cost: z.number().nonnegative().nullable().optional(),
  /** Merma declarada manualmente antes de completar */
  waste_kg: z.number().nonnegative().default(0).optional(),
  notes: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type UnifiedProductionOrder = z.infer<typeof UnifiedProductionOrderSchema>;

export const CreateUnifiedProductionOrderSchema = UnifiedProductionOrderSchema.omit({
  id: true,
  status: true,
  batch_number: true,
  actual_batch_kg: true,
  production_cost: true,
  completed_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
});

export type CreateUnifiedProductionOrder = z.infer<typeof CreateUnifiedProductionOrderSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Presentations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Entity: UnifiedPresentation
 *
 * Línea de presentación comercial dentro de una UnifiedProductionOrder.
 * Cada fila representa cuántas unidades de un PRODUCTO_TERMINADO se van
 * a obtener del lote, consumiendo capacity_kg × units_to_produce kg del total.
 */
export const UnifiedPresentationSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  /** Debe ser PRODUCTO_TERMINADO — trigger valida en DB */
  product_id: z.string().uuid(),
  /** Nombre del producto (join en SELECT *) — no en tabla */
  product_name: z.string().optional(),
  /** SKU del producto */
  product_sku: z.string().optional(),
  /** Unidades comerciales a producir */
  units_to_produce: z.number().positive("Las unidades deben ser positivas"),
  /** Snapshot de capacidad en kg (products.capacity convertido a kg) */
  capacity_kg: z.number().positive("La capacidad en kg debe ser positiva"),
  /** units_to_produce × capacity_kg */
  total_kg: z.number().positive(),
  created_at: z.string().datetime().optional(),
});

export type UnifiedPresentation = z.infer<typeof UnifiedPresentationSchema>;

export const CreateUnifiedPresentationSchema = UnifiedPresentationSchema.omit({
  id: true,
  product_name: true,
  product_sku: true,
  total_kg: true, // calculado localmente; DB lo recibe o lo computa
  created_at: true,
});

export type CreateUnifiedPresentation = z.infer<typeof CreateUnifiedPresentationSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Presentación en edición en el formulario (antes de persistir) */
export interface DraftPresentation {
  /** UUID temporal del lado cliente para identificar la fila en el form */
  clientId: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  units_to_produce: string; // string para el input
  capacity_kg: number;
  /** Unidad comercial legible del producto (p.ej. "200g", "paquete") */
  sales_unit_name: string;
  /** Kg totales asignados a esta presentación: units × capacity_kg */
  total_kg: number;
  /** Stock disponible del PRODUCTO_TERMINADO (para alertas) */
  stock_available: number;
  /** Resultado de chequeo de materiales de empaque */
  packaging_ok: boolean | null;
}
