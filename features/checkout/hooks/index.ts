"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { getNextDeliveryWindow } from "@shared/lib/utils";
import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  quantity: number;
  image_url: string | null;
  reservation_id: string | null;
  conversion_factor?: number;
  sales_unit_name?: string | null;
  capacity_unit?: string | null;
}

export interface PaymentConfig {
  id: number;
  pichincha_holder:       string | null;
  pichincha_account:      string | null;
  pichincha_account_type: string | null;
  pichincha_cedula:       string | null;
  pichincha_qr_path:      string | null;
  pichincha_qr_key:       string | null;
  guayaquil_holder:       string | null;
  guayaquil_account:      string | null;
  guayaquil_account_type: string | null;
  guayaquil_cedula:       string | null;
  paypal_email:           string | null;
  paypal_me:              string | null;
  updated_at:             string | null;
  updated_by:             string | null;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  fulfillment_type: string;
  total: number;
  payment_receipt_url: string | null;
  payment_method: string | null;
  delivery_date: string | null;
  shipping_address: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemDetail {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    sku: string;
    unit: string;
    sales_unit_name: string | null;
    conversion_factor: number;
  } | null;
}

export interface OrderWithDetails extends Order {
  order_items?: OrderItemDetail[];
}

const ORDER_ITEMS_SELECT = `
  id,
  product_id,
  quantity,
  unit_price,
  subtotal,
  products(name, sku, unit, sales_unit_name, conversion_factor)
`;

/**
 * Genera el código de retiro a partir del UUID de la orden.
 * Formato: PAU-XXXXXXXX (8 hex chars del UUID sin guiones)
 */
export function pickupCode(orderId: string): string {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

/**
 * Convierte la clave de storage (`pichincha_qr_key`) del QR Pichincha/DeUna
 * en la ruta del proxy autenticado `/api/payment-qr/<key>`.
 *
 * Devuelve `null` si no hay clave — el caller debe mostrar el placeholder
 * de "QR pendiente de configuración".
 */
export function paymentQrUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/payment-qr/${key}`;
}

/**
 * Convierte el valor almacenado en `payment_receipt_url` en la ruta del
 * proxy autenticado `/api/receipts/<path>`.
 *
 * Soporta dos formatos:
 *  - Nuevo (path):   "userId/1234567890.pdf"  → "/api/receipts/userId/1234567890.pdf"
 *  - Legacy (URL):   "https://…/objects/userId%2F…" → extrae el path y construye la ruta
 */
export function receiptProxyUrl(value: string): string {
  if (!value) return "";
  // Ya es una ruta relativa (nuevo formato)
  if (!value.startsWith("http")) {
    return `/api/receipts/${value}`;
  }
  // Legacy: URL pública de Insforge — extraer el path del segmento /objects/
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/objects\/(.+)$/);
    if (match) {
      const storagePath = decodeURIComponent(match[1]);
      return `/api/receipts/${storagePath}`;
    }
  } catch { /* ignorar URL inválida */ }
  // Fallback: devolver la URL original (bucket público aún)
  return value;
}

const CART_KEY_PREFIX = "pauleam_cart_";
export { CART_KEY_PREFIX };

function cartKey(userId: string): string {
  return `${CART_KEY_PREFIX}${userId}`;
}

let globalCartItems: CartItem[] = [];
let currentUserId: string | null = null;
const cartListeners = new Set<() => void>();

function loadCartForUser(userId: string | null): CartItem[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const saved = localStorage.getItem(cartKey(userId));
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCartForUser(userId: string | null, items: CartItem[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(cartKey(userId));
    } else {
      localStorage.setItem(cartKey(userId), JSON.stringify(items));
    }
  } catch {
    /* ignore quota / serialization errors */
  }
}

function notifyCart() {
  saveCartForUser(currentUserId, globalCartItems);
  cartListeners.forEach((l) => l());
}

/**
 * Hook para el carrito de compras con reservas de stock.
 * Las reservas usan pg_try_advisory_xact_lock para evitar sobreventa.
 *
 * PER-USER ISOLATION: cart storage is keyed by userId (`pauleam_cart_<userId>`).
 * Passing `null` (guest) yields an empty cart. Logging out / switching user
 * triggers a reload via the `[userId]` effect dep, so each user only ever
 * sees their own items. The legacy single-key `pauleam_cart` (no suffix)
 * is intentionally ignored — it was the source of the cross-session leak.
 */
export function useCart(userId: string | null = null) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  useEffect(() => {
    // Reload cart when the active user changes (login, logout, switch user).
    currentUserId = userId;
    globalCartItems = loadCartForUser(userId);
    /* eslint-disable react-hooks/set-state-in-effect */
    setItems([...globalCartItems]);

    const listener = () => setItems([...globalCartItems]);
    /* eslint-enable react-hooks/set-state-in-effect */
    cartListeners.add(listener);
    return () => {
      cartListeners.delete(listener);
    };
  }, [userId]);

  const addItem = useCallback(
    async (
      product: {
        id: string;
        name: string;
        sku: string;
        unit: string;
        price: number;
        image_url: string | null;
        conversion_factor?: number;
        sales_unit_name?: string | null;
        capacity_unit?: string | null;
      },
      quantity: number = 1
    ) => {
      setLoading(true);
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        const conversionFactor = product.conversion_factor ?? 1.0;
        const physicalQuantity = Number((quantity / conversionFactor).toFixed(4));

        const { data, error } = await insforge.database.rpc("reserve_stock", {
          p_user_id: userData.user.id,
          p_product_id: product.id,
          p_quantity: physicalQuantity,
        });

        if (error) throw error;

        // Sync module-level user to the in-flight add (handles login
        // transition where useEffect hasn't re-run with the new userId yet).
        if (currentUserId !== userData.user.id) {
          currentUserId = userData.user.id;
          globalCartItems = loadCartForUser(currentUserId);
        }

        const existing = globalCartItems.find((i) => i.product_id === product.id);
        if (existing) {
          globalCartItems = globalCartItems.map((i) =>
            i.product_id === product.id
              ? {
                  ...i,
                  quantity: i.quantity + quantity,
                  reservation_id: data as string,
                  conversion_factor: product.conversion_factor,
                  sales_unit_name: product.sales_unit_name,
                  capacity_unit: product.capacity_unit,
                }
              : i
          );
        } else {
          globalCartItems = [
            ...globalCartItems,
            {
              product_id: product.id,
              name: product.name,
              sku: product.sku,
              unit: product.unit,
              price: product.price,
              quantity,
              image_url: product.image_url,
              reservation_id: data as string,
              conversion_factor: product.conversion_factor,
              sales_unit_name: product.sales_unit_name,
              capacity_unit: product.capacity_unit,
            },
          ];
        }
        notifyCart();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al agregar al carrito",
        };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const item = globalCartItems.find((i) => i.product_id === productId);
      if (item?.reservation_id) {
        await insforge.database
          .from("stock_reservations")
          .delete()
          .eq("id", item.reservation_id);
      }
      globalCartItems = globalCartItems.filter((i) => i.product_id !== productId);
      notifyCart();
    },
    [insforge]
  );

  const clearCart = useCallback(async () => {
    const { data: userData } = await insforge.auth.getCurrentUser();
    if (userData?.user?.id) {
      await insforge.database
        .from("stock_reservations")
        .delete()
        .eq("user_id", userData.user.id);
    }
    globalCartItems = [];
    notifyCart();
  }, [insforge]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Distinct products (one tick per SKU, not units). 8 lbs of the same cheese = 1.
  const itemCount = items.length;

  return {
    items,
    loading,
    total,
    itemCount,
    addItem,
    removeItem,
    clearCart,
    isEmpty: items.length === 0,
  };
}

/**
 * Hook para el proceso de checkout.
 */
export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const submitOrder = useCallback(
    async (params: {
      items: CartItem[];
      total: number;
      shippingAddress: string;
      paymentReceipt: File;
      paymentMethod: string;
      fulfillmentType: "ENVIO" | "RETIRO_EN_PLANTA";
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        // 1. Subir comprobante a Storage
        const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
        const ALLOWED_MIME_TYPES  = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];
        const fileExt = params.paymentReceipt.name.split(".").pop()?.toLowerCase() ?? "";
        if (
          !ALLOWED_EXTENSIONS.includes(fileExt) ||
          !ALLOWED_MIME_TYPES.includes(params.paymentReceipt.type)
        ) {
          throw new Error(
            "Solo se permiten archivos PDF, JPG, PNG o WEBP como comprobante de pago"
          );
        }
        const filePath = `${userData.user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await insforge.storage
          .from("payment-receipts")
          .upload(filePath, params.paymentReceipt);

        if (uploadError) throw uploadError;

        // 2. Guardar la ruta del archivo (no la URL pública).
        //    El bucket es privado — el acceso se hace a través del proxy /api/receipts/*.
        const publicUrl = filePath;

        // 3. Calcular fecha de entrega (próximo viernes tras corte del jueves 5 PM Ecuador)
        const { deliveryDate } = getNextDeliveryWindow();
        const deliveryDateStr = deliveryDate.toISOString().split("T")[0];

        // 4. Crear la orden
        const { data: order, error: orderError } = await insforge.database
          .from("orders")
          .insert({
            user_id: userData.user.id,
            status: "PAGADO",
            fulfillment_type: params.fulfillmentType,
            total: params.total,
            payment_receipt_url: publicUrl,
            payment_method: params.paymentMethod,
            delivery_date: deliveryDateStr,
            shipping_address: params.shippingAddress || null,
            notes: params.notes ?? null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderId = (order as Order).id;

        // 5. Crear los items
        const orderItems = params.items.map((item) => ({
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await insforge.database
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // 6. Limpiar reservas del usuario
        await insforge.database
          .from("stock_reservations")
          .delete()
          .eq("user_id", userData.user.id);

        return { data: order as Order, error: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error en el checkout";
        setError(message);
        return { data: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { submitOrder, loading, error };
}

/**
 * Hook para que el admin gestione órdenes de venta.
 * Incluye items de cada orden con detalles del producto.
 */
export function useOrderManagement() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("orders")
        .select(`*, order_items(${ORDER_ITEMS_SELECT})`)
        .order("created_at", { ascending: false });

      setOrders((data as OrderWithDetails[]) ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const approveOrder = useCallback(
    async (orderId: string) => {
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();

        // 1. Fetch order to determine fulfillment type
        const { data: orderData, error: orderFetchError } = await insforge.database
          .from("orders")
          .select("fulfillment_type")
          .eq("id", orderId)
          .single();

        if (orderFetchError) throw orderFetchError;
        const fulfillmentType = (orderData as { fulfillment_type: string }).fulfillment_type;

        // 2. For ENVIO: deduct inventory now. For RETIRO_EN_PLANTA: defer to confirmPickup.
        if (fulfillmentType === "ENVIO") {
          const { data: itemsData, error: itemsError } = await insforge.database
            .from("order_items")
            .select(ORDER_ITEMS_SELECT)
            .eq("order_id", orderId);

          if (itemsError) throw itemsError;

          const items = (itemsData as unknown as OrderItemDetail[]) ?? [];
          for (const item of items) {
            const conversionFactor = item.products?.conversion_factor ?? 1.0;
            const physicalQuantity = Number((item.quantity / conversionFactor).toFixed(4));

            const { error: ledgerError } = await insforge.database
              .from("inventory_ledger")
              .insert({
                product_id: item.product_id,
                movement_type: "EGRESO",
                quantity: physicalQuantity,
                reference_type: "VENTA",
                reference_id: orderId,
                notes: `Venta #${orderId.substring(0, 8)}`,
              });

            if (ledgerError) throw ledgerError;
          }
        }

        // 3. Mark as APROBADO (payment verified)
        const { error } = await insforge.database
          .from("orders")
          .update({
            status: "APROBADO",
            approved_by: userData?.user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (error) throw error;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al aprobar orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  const confirmPickup = useCallback(
    async (orderId: string) => {
      try {
        const { data: itemsData, error: itemsError } = await insforge.database
          .from("order_items")
          .select(ORDER_ITEMS_SELECT)
          .eq("order_id", orderId);

        if (itemsError) throw itemsError;

        const items = (itemsData as unknown as OrderItemDetail[]) ?? [];
        for (const item of items) {
          const conversionFactor = item.products?.conversion_factor ?? 1.0;
          const physicalQuantity = Number((item.quantity / conversionFactor).toFixed(4));

          const { error: ledgerError } = await insforge.database
            .from("inventory_ledger")
            .insert({
              product_id: item.product_id,
              movement_type: "EGRESO",
              quantity: physicalQuantity,
              reference_type: "VENTA",
              reference_id: orderId,
              notes: `Retiro en planta #${orderId.substring(0, 8)}`,
            });

          if (ledgerError) throw ledgerError;
        }

        const { error } = await insforge.database
          .from("orders")
          .update({ status: "COMPLETADO" })
          .eq("id", orderId);

        if (error) throw error;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al confirmar entrega",
        };
      }
    },
    [insforge, fetchOrders]
  );

  const rejectOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error } = await insforge.database
          .from("orders")
          .update({ status: "CANCELADO" })
          .eq("id", orderId);

        if (error) throw error;
        await fetchOrders();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al rechazar orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  return { orders, loading, approveOrder, rejectOrder, confirmPickup, refetch: fetchOrders };
}

/**
 * Hook para leer la configuración de métodos de pago.
 * Todos los usuarios autenticados pueden leer; solo admins pueden escribir (RLS).
 */
export function usePaymentConfig() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  useEffect(() => {
    insforge.database
      .from("payment_config")
      .select("*")
      .eq("id", 1)
      .then(
        ({ data, error }) => {
          if (!error && data?.[0]) setConfig(data[0] as PaymentConfig);
          setLoading(false);
        },
        () => setLoading(false)
      );
  }, [insforge]);

  return { config, loading };
}

/**
 * Hook para que el admin actualice la configuración de métodos de pago.
 * El RLS de la DB rechaza llamadas de usuarios sin rol admin.
 */
export function usePaymentConfigMutations() {
  const insforge = getInsforge();

  const saveConfig = useCallback(
    async (values: Partial<PaymentConfig>) => {
      const { data: userData } = await insforge.auth.getCurrentUser();
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
        updated_by: userData?.user?.id ?? null,
      };
      // Remove read-only id field if present
      delete (payload as Partial<PaymentConfig> & { id?: unknown }).id;

      const { error } = await insforge.database
        .from("payment_config")
        .update(payload)
        .eq("id", 1);

      return { error: error ? (error instanceof Error ? error.message : String(error)) : null };
    },
    [insforge]
  );

  return { saveConfig };
}

/**
 * Hook para que el usuario vea su historial de órdenes.
 */
export function useUserOrders() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      if (!userData?.user?.id) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data } = await insforge.database
        .from("orders")
        .select(`*, order_items(${ORDER_ITEMS_SELECT})`)
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      setOrders((data as OrderWithDetails[]) ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}
