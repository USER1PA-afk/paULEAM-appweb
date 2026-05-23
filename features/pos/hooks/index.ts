"use client";

import { useState, useEffect, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** UUID fijo del usuario "Consumidor Final" (espejado en la migración SQL). */
export const CONSUMIDOR_FINAL_ID = "00000000-0000-0000-0000-999999999999";
export const CONSUMIDOR_FINAL_NAME = "Consumidor Final";
export const CONSUMIDOR_FINAL_CEDULA = "9999999999999";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PosProduct {
  product_id: string;
  name: string;
  sku: string;
  unit: string;                      // unidad física de almacén (kg, lt…)
  price: number;                     // precio por unidad comercial
  image_url: string | null;
  conversion_factor: number;         // kg por unidad comercial (ej: 2.20462)
  sales_unit_name: string;           // "Libra" | "Unidad" | etc.
  stock_actual: number;              // stock físico total en kg
  stock_available: number;           // stock disponible en kg (descontando reservas)
  /** Stock disponible expresado en unidades comerciales (redondeado hacia abajo). */
  stock_commercial: number;
}

export interface PosCartItem {
  product_id: string;
  name: string;
  image_url: string | null;
  price: number;                     // precio por unidad comercial
  quantity: number;                  // cantidad en unidades comerciales
  sales_unit_name: string;
  conversion_factor: number;
}

export type PosPaymentMethod = "EFECTIVO" | "QR_DEUNA";

export interface PosCustomer {
  id: string;
  full_name: string;
  cedula: string;
}

// ─── usePosProducts ───────────────────────────────────────────────────────────

/**
 * Carga los productos terminados activos desde la vista stock_summary,
 * calculando el stock disponible en unidades comerciales.
 */
export function usePosProducts() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const db = getInsforge();
    try {
      const { data, error: dbError } = await db.database
        .from("stock_summary")
        .select(
          "product_id, name, sku, unit, price, image_url, conversion_factor, sales_unit_name, stock_actual, stock_available"
        )
        .eq("type", "PRODUCTO_TERMINADO")
        .eq("is_active", true)
        .order("name");

      if (dbError) throw dbError;

      const rows = (data as Omit<PosProduct, "stock_commercial">[]) ?? [];

      setProducts(
        rows
          .filter((p) => p.sales_unit_name) // solo productos con unidad comercial configurada
          .map((p) => {
            const cf = p.conversion_factor ?? 1;
            const stockCommercial = Math.floor((p.stock_available ?? 0) * cf * 10000) / 10000;
            return {
              ...p,
              conversion_factor: cf,
              sales_unit_name: p.sales_unit_name ?? p.unit,
              stock_commercial: stockCommercial,
            };
          })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

// ─── usePosCart ───────────────────────────────────────────────────────────────

/**
 * Carrito POS local en memoria (sin localStorage ni reservas de stock).
 * Cada venta es instantánea → no hay ventana de reserva.
 */
export function usePosCart() {
  const [items, setItems] = useState<PosCartItem[]>([]);

  /**
   * Agrega 1 unidad comercial de un producto.
   * Si ya existe en el carrito, incrementa la cantidad.
   */
  const addItem = useCallback((product: PosProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.product_id,
          name: product.name,
          image_url: product.image_url,
          price: product.price,
          quantity: 1,
          sales_unit_name: product.sales_unit_name,
          conversion_factor: product.conversion_factor,
        },
      ];
    });
  }, []);

  const increaseQty = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i
      )
    );
  }, []);

  const decreaseQty = useCallback((productId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.product_id === productId);
      if (!item) return prev;
      if (item.quantity <= 1) {
        return prev.filter((i) => i.product_id !== productId);
      }
      return prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    total,
    itemCount,
    isEmpty: items.length === 0,
    addItem,
    increaseQty,
    decreaseQty,
    removeItem,
    clearCart,
  };
}

// ─── usePosCheckout ───────────────────────────────────────────────────────────

/**
 * Ejecuta la venta kiosko mediante la RPC atómica process_kiosk_sale.
 * El backend convierte unidades comerciales → kg dentro de la transacción.
 */
export function usePosCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const submitSale = useCallback(
    async (params: {
      operatorId: string;
      customerId: string;
      paymentMethod: PosPaymentMethod;
      items: PosCartItem[];
      total: number;
    }) => {
      setLoading(true);
      setError(null);
      setLastOrderId(null);

      const db = getInsforge();

      try {
        // Construir el array de ítems para la RPC.
        // La conversión kg se calcula en el backend (process_kiosk_sale),
        // pero enviamos conversion_factor para que la función lo use.
        const rpcItems = params.items.map((item) => ({
          product_id: item.product_id,
          qty_commercial: Number(item.quantity.toFixed(4)),
          unit_price: Number(item.price.toFixed(2)),
          conversion_factor: Number((item.conversion_factor ?? 1).toFixed(4)),
        }));

        const { data, error: rpcError } = await db.database.rpc(
          "process_kiosk_sale",
          {
            p_operator_id: params.operatorId,
            p_customer_id: params.customerId,
            p_payment_method: params.paymentMethod,
            p_items: rpcItems,
            p_total: Number(params.total.toFixed(2)),
          }
        );

        if (rpcError) throw rpcError;

        const orderId = data as string;
        setLastOrderId(orderId);
        return { orderId, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error al procesar la venta";
        setError(message);
        return { orderId: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { submitSale, loading, error, lastOrderId };
}

// ─── usePosCustomerSearch ─────────────────────────────────────────────────────

/**
 * Búsqueda rápida de cliente por cédula/RUC (campo phone en profiles).
 * Devuelve al Consumidor Final como default si no hay búsqueda activa.
 */
export function usePosCustomerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (cedula: string) => {
    if (!cedula.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const db = getInsforge();
    try {
      const { data } = await db.database
        .from("profiles")
        .select("id, full_name, phone")
        .ilike("phone", `%${cedula.trim()}%`)
        .neq("id", CONSUMIDOR_FINAL_ID) // excluir al consumidor final del search
        .limit(5);

      const rows = (data as { id: string; full_name: string; phone: string }[]) ?? [];
      setResults(
        rows.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          cedula: r.phone ?? "",
        }))
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, searching };
}
