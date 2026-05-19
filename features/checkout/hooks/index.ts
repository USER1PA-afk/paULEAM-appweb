"use client";

import { getInsforge } from "@shared/lib/insforge/client";
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
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  total: number;
  payment_receipt_url: string | null;
  shipping_address: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemDetail {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    sku: string;
    unit: string;
  } | null;
}

export interface OrderWithDetails extends Order {
  order_items?: OrderItemDetail[];
}

const ORDER_ITEMS_SELECT = `
  id,
  quantity,
  unit_price,
  subtotal,
  products(name, sku, unit)
`;

/**
 * Genera el código de retiro a partir del UUID de la orden.
 * Formato: PAU-XXXXXXXX (8 hex chars del UUID sin guiones)
 */
export function pickupCode(orderId: string): string {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

let globalCartItems: CartItem[] = [];
let isCartInitialized = false;
const cartListeners = new Set<() => void>();

function notifyCart() {
  if (typeof window !== "undefined") {
    localStorage.setItem("pauleam_cart", JSON.stringify(globalCartItems));
  }
  cartListeners.forEach((l) => l());
}

/**
 * Hook para el carrito de compras con reservas de stock.
 * Las reservas usan pg_try_advisory_xact_lock para evitar sobreventa.
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  useEffect(() => {
    if (!isCartInitialized) {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("pauleam_cart");
        if (saved) {
          try {
            globalCartItems = JSON.parse(saved);
          } catch {
            globalCartItems = [];
          }
        }
      }
      isCartInitialized = true;
    }
    setItems([...globalCartItems]);

    const listener = () => setItems([...globalCartItems]);
    cartListeners.add(listener);
    return () => {
      cartListeners.delete(listener);
    };
  }, []);

  const addItem = useCallback(
    async (
      product: {
        id: string;
        name: string;
        sku: string;
        unit: string;
        price: number;
        image_url: string | null;
      },
      quantity: number = 1
    ) => {
      setLoading(true);
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        const { data, error } = await insforge.database.rpc("reserve_stock", {
          p_user_id: userData.user.id,
          p_product_id: product.id,
          p_quantity: quantity,
        });

        if (error) throw error;

        const existing = globalCartItems.find((i) => i.product_id === product.id);
        if (existing) {
          globalCartItems = globalCartItems.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + quantity, reservation_id: data as string }
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
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        // 1. Subir comprobante a Storage
        const fileExt = params.paymentReceipt.name.split(".").pop();
        const filePath = `${userData.user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await insforge.storage
          .from("payment-receipts")
          .upload(filePath, params.paymentReceipt);

        if (uploadError) throw uploadError;

        // 2. URL pública del comprobante
        const publicUrl = insforge.storage
          .from("payment-receipts")
          .getPublicUrl(filePath);

        // 3. Crear la orden
        const { data: order, error: orderError } = await insforge.database
          .from("orders")
          .insert({
            user_id: userData.user.id,
            status: "PAGADO",
            total: params.total,
            payment_receipt_url: publicUrl,
            shipping_address: params.shippingAddress,
            notes: params.notes ?? null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderId = (order as Order).id;

        // 4. Crear los items
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

        // 5. Registrar EGRESOs en inventory_ledger
        for (const item of params.items) {
          await insforge.database.from("inventory_ledger").insert({
            product_id: item.product_id,
            movement_type: "EGRESO",
            quantity: item.quantity,
            reference_type: "VENTA",
            reference_id: orderId,
            notes: `Venta #${orderId.substring(0, 8)}`,
          });
        }

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const approveOrder = useCallback(
    async (orderId: string) => {
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
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

  return { orders, loading, approveOrder, rejectOrder, refetch: fetchOrders };
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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}
