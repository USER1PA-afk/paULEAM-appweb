"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

interface CartItem {
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
  created_at: string;
  updated_at: string;
}

/**
 * Hook para el carrito de compras con reservas de stock.
 * Las reservas usan pg_try_advisory_xact_lock para evitar sobreventa.
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  // Cargar carrito desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem("pauleam_cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {
        localStorage.removeItem("pauleam_cart");
      }
    }
  }, []);

  // Persistir en localStorage
  useEffect(() => {
    localStorage.setItem("pauleam_cart", JSON.stringify(items));
  }, [items]);

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
        // Reservar stock vía función RPC
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        const { data, error } = await insforge.database.rpc("reserve_stock", {
          p_user_id: userData.user.id,
          p_product_id: product.id,
          p_quantity: quantity,
        });

        if (error) throw error;

        const existing = items.find((i) => i.product_id === product.id);
        if (existing) {
          setItems((prev) =>
            prev.map((i) =>
              i.product_id === product.id
                ? { ...i, quantity: i.quantity + quantity, reservation_id: data }
                : i
            )
          );
        } else {
          setItems((prev) => [
            ...prev,
            {
              product_id: product.id,
              name: product.name,
              sku: product.sku,
              unit: product.unit,
              price: product.price,
              quantity: quantity,
              image_url: product.image_url,
              reservation_id: data as string,
            },
          ]);
        }
        return { error: null };
      } catch (err: unknown) {
        return {
          error:
            err instanceof Error ? err.message : "Error al agregar al carrito",
        };
      } finally {
        setLoading(false);
      }
    },
    [items, insforge]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const item = items.find((i) => i.product_id === productId);
      if (item?.reservation_id) {
        await insforge.database
          .from("stock_reservations")
          .delete()
          .eq("id", item.reservation_id);
      }
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    },
    [items, insforge]
  );

  const clearCart = useCallback(async () => {
    // Liberar todas las reservas
    const { data: userData } = await insforge.auth.getCurrentUser();
    if (userData?.user?.id) {
      await insforge.database
        .from("stock_reservations")
        .delete()
        .eq("user_id", userData.user.id);
    }
    setItems([]);
    localStorage.removeItem("pauleam_cart");
  }, [insforge]);

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
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
 * Sube el comprobante de pago a Insforge Storage y crea la orden.
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

        // 2. Obtener URL pública del comprobante
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
            notes: params.notes,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // 4. Crear los items de la orden
        const orderItems = params.items.map((item) => ({
          order_id: (order as Order).id,
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
            reference_id: (order as Order).id,
            notes: `Venta #${((order as Order).id).substring(0, 8)}`,
          });
        }

        // 6. Limpiar reservas del usuario
        await insforge.database
          .from("stock_reservations")
          .delete()
          .eq("user_id", userData.user.id);

        return { data: order as Order, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error en el checkout";
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
 */
export function useOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      setOrders((data as Order[]) ?? []);
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
          error:
            err instanceof Error ? err.message : "Error al aprobar orden",
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
          error:
            err instanceof Error ? err.message : "Error al rechazar orden",
        };
      }
    },
    [insforge, fetchOrders]
  );

  return { orders, loading, approveOrder, rejectOrder, refetch: fetchOrders };
}
