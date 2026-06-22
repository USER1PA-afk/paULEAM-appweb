import { z } from "zod";

/**
 * Entity: Order
 *
 * Orden de venta del E-Commerce.
 * Estado: PENDIENTE → PAGADO → APROBADO → COMPLETADO / CANCELADO
 * ENVIO: inventario se deduce al APROBADO.
 * RETIRO_EN_PLANTA: inventario se deduce al confirmar entrega física (→ COMPLETADO).
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

export const FulfillmentTypeEnum = z.enum(["ENVIO", "RETIRO_EN_PLANTA"]);
export type FulfillmentType = z.infer<typeof FulfillmentTypeEnum>;

export const FULFILLMENT_TYPE_LABELS: Record<FulfillmentType, string> = {
  ENVIO:            "Envío a domicilio",
  RETIRO_EN_PLANTA: "Retiro en planta",
};

export const PaymentMethodEnum = z.enum([
  "EFECTIVO",
  "QR_DEUNA",
  "TRANSFERENCIA",
  "PICHINCHA",
  "TRANSFERENCIA_PICHINCHA",
  "QR_PICHINCHA",
  "TRANSFERENCIA_GUAYAQUIL",
  "PAYPAL",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO:                "Efectivo",
  QR_DEUNA:               "QR DeUna",
  TRANSFERENCIA:           "Transferencia",
  PICHINCHA:               "Banco Pichincha",
  TRANSFERENCIA_PICHINCHA: "Pichincha — Transferencia",
  QR_PICHINCHA:            "Pichincha — QR",
  TRANSFERENCIA_GUAYAQUIL: "Guayaquil — Transferencia",
  PAYPAL:                  "PayPal",
};

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
  fulfillment_type: FulfillmentTypeEnum.default("ENVIO"),
  total: z.number().nonnegative(),
  payment_receipt_url: z.string().url().optional(),
  payment_method: PaymentMethodEnum.nullable().optional(),
  delivery_date: z.string().nullable().optional(),
  items: z.array(OrderItemSchema).optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
