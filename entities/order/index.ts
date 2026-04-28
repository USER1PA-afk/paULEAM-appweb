import { z } from "zod";

/**
 * Entity: Order
 *
 * Orden de venta del E-Commerce.
 * Estado: PENDIENTE → PAGADO → APROBADO → ENVIADO → COMPLETADO
 * El admin valida el comprobante manualmente.
 */

export const OrderStatusEnum = z.enum([
  "PENDIENTE",
  "PAGADO",
  "APROBADO",
  "ENVIADO",
  "COMPLETADO",
  "CANCELADO",
]);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: OrderStatusEnum,
  total: z.number().nonnegative(),
  payment_receipt_url: z.string().url().optional(), // URL del comprobante en Insforge Storage
  items: z.array(OrderItemSchema).optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
