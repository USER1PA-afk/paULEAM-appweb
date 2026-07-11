/**
 * Feature: POS (Punto de Venta — Kiosko)
 *
 * Interfaz táctil para ventas presenciales en el kiosko de la planta ULEAM.
 * Rol requerido: sales_kiosk | admin
 *
 * Flujo:
 *  1. Operador selecciona productos → carrito local (sin reservas de stock)
 *  2. Elige método de pago (Efectivo / QR Deuna)
 *  3. Presiona "Cobrar y Despachar" → RPC atómica `process_kiosk_sale`
 *     que crea la orden, ítems y EGRESOs en inventory_ledger (con conversión kg)
 *
 * Exports:
 * - Hooks: usePosProducts, usePosCart, usePosCheckout, usePosCustomerSearch
 * - Constants: CONSUMIDOR_FINAL_ID, CONSUMIDOR_FINAL_NAME, CONSUMIDOR_FINAL_CEDULA
 */

export {
  usePosProducts,
  usePosCart,
  usePosCheckout,
  usePosCustomerSearch,
  CONSUMIDOR_FINAL_ID,
  CONSUMIDOR_FINAL_NAME,
  CONSUMIDOR_FINAL_CEDULA,
} from "./hooks";

export type {
  PosProduct,
  PosCartItem,
  PosPaymentMethod,
  PosCustomer,
} from "./hooks";
