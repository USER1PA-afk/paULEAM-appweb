"use client";

import { useState, useEffect, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";

/**
 * Resilient POS product loader.
 *
 * Why three fallbacks:
 *   The stock_summary view's column list is hand-curated (CREATE VIEW ...
 *   SELECT id, name, ...). Each new product column requires a migration
 *   to DROP/CREATE the view. If a deployment is missing the latest view
 *   migration, queries against it 400 with "column does not exist". This
 *   function tries progressively older column lists, then falls back to
 *   the products table directly, so the kiosk never goes dark.
 *
 * Tiers (each tried only if the previous one 400s):
 *   1. stock_summary with show_in_pos (newest view, admin-controlled visibility)
 *   2. stock_summary without show_in_pos column/filter (mid-era view)
 *   3. stock_summary minimal select (early view — stock_actual only)
 *   4. products table directly (view is broken or missing — last resort;
 *      stock_actual/stock_available will be undefined; cashier sees "Agotado"
 *      for everything but the rest of the UI works)
 */
async function loadPosProducts(
  db: ReturnType<typeof getInsforge>
): Promise<PosProduct[]> {
  type Row = Omit<PosProduct, "stock_commercial">;

  const PRIMARY = [
    "product_id, name, sku, unit, price, image_url, capacity_unit, show_in_pos, conversion_factor, sales_unit_name, stock_actual, stock_available",
  ] as const;

  const FALLBACK_NO_SHOW = [
    "product_id, name, sku, unit, price, image_url, capacity_unit, conversion_factor, sales_unit_name, stock_actual, stock_available",
  ] as const;

  const FALLBACK_MINIMAL = [
    "product_id, name, sku, unit, price, image_url, conversion_factor, sales_unit_name, stock_actual, stock_available",
  ] as const;

  const isMissingColumn = (err: { message?: string; code?: string } | null) => {
    if (!err) return false;
    const msg = err.message ?? "";
    return (
      err.code === "PGRST204" ||
      err.code === "42703" ||
      /column .* does not exist/i.test(msg) ||
      /could not find .* column/i.test(msg) ||
      /schema cache/i.test(msg)
    );
  };

  const tryView = async (
    select: string,
    includeShowInPos: boolean
  ): Promise<{ rows: Row[]; error: { message?: string; code?: string } | null }> => {
    let q = db.database
      .from("stock_summary")
      .select(select)
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0);
    if (includeShowInPos) q = q.eq("show_in_pos", true);
    q = q.order("name");
    const { data, error } = await q;
    if (error) return { rows: [], error: error as { message?: string; code?: string } };
    return { rows: ((data ?? []) as unknown as Row[]), error: null };
  };

  // Tier 1
  let res = await tryView(PRIMARY[0], true);
  if (res.error && isMissingColumn(res.error)) {
    console.warn(
      "[pos] stock_summary view missing show_in_pos (or another column). " +
      "Apply migrations 20260616000000_add-show-in-pos.sql + " +
      "20260616000001_stock-summary-add-pos-fields.sql. Trying fallback #1."
    );
    res = await tryView(FALLBACK_NO_SHOW[0], false);
  }

  // Tier 2 → Tier 3 if the view is older still
  if (res.error && isMissingColumn(res.error)) {
    console.warn(
      "[pos] stock_summary view missing newer columns. " +
      "Rebuild it via migration 20260616000001. Trying fallback #2 (minimal select)."
    );
    res = await tryView(FALLBACK_MINIMAL[0], false);
  }

  // Tier 3 → products table (last resort)
  if (res.error) {
    console.warn(
      "[pos] stock_summary view is unusable (" + (res.error.message ?? "unknown") + "). " +
      "Falling back to the products table directly. Stock numbers will read 0 " +
      "until the view migration is applied. Cashier can still select products " +
      "and complete sales; the RPC will validate actual stock server-side."
    );
    const { data: prodRows, error: prodErr } = await db.database
      .from("products")
      .select("id, name, sku, unit, price, image_url, capacity_unit, conversion_factor, sales_unit_name, is_active, show_in_pos")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0)
      .order("name");
    if (prodErr) throw prodErr;
    const mapped: Row[] = ((prodRows as Array<Record<string, unknown>>) ?? []).map((p) => ({
      product_id: String(p.id),
      name: String(p.name ?? ""),
      sku: String(p.sku ?? ""),
      unit: String(p.unit ?? "kg"),
      price: Number(p.price ?? 0),
      image_url: (p.image_url as string | null) ?? null,
      capacity_unit: (p.capacity_unit as string | null) ?? null,
      show_in_pos: p.show_in_pos === undefined ? true : Boolean(p.show_in_pos),
      conversion_factor: Number(p.conversion_factor ?? 1),
      sales_unit_name: String(p.sales_unit_name ?? p.unit ?? "unidad"),
      // View-derived columns absent in this tier — set to 0 so the UI shows
      // the product as "Agotado" rather than crashing. The kiosk still
      // works; actual availability is validated by process_kiosk_sale.
      stock_actual: 0,
      stock_available: 0,
    }));
    res = { rows: mapped, error: null };
  }

  if (res.error) throw res.error;

  return res.rows.map((p) => {
    const cf = p.conversion_factor ?? 1;
    const stockCommercial = Math.floor((p.stock_available ?? 0) * cf * 10000) / 10000;
    return {
      ...p,
      conversion_factor: cf,
      sales_unit_name: p.sales_unit_name ?? p.unit,
      stock_commercial: stockCommercial,
    };
  });
}

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
  capacity_unit: string | null;
  show_in_pos: boolean;
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
  stock_commercial: number;          // techo de unidades disponibles al momento de agregar
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
      const rows = await loadPosProducts(db);
      setProducts(rows);
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
    const max = Math.floor(product.stock_commercial);
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= max) return prev;
        return prev.map((i) =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      if (max <= 0) return prev;
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
          stock_commercial: max,
        },
      ];
    });
  }, []);

  const increaseQty = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId && i.quantity < i.stock_commercial
          ? { ...i, quantity: i.quantity + 1 }
          : i
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

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.product_id === productId);
      if (!item) return prev;
      const clamped = Math.min(Math.max(1, Math.floor(qty)), item.stock_commercial);
      return prev.map((i) => i.product_id === productId ? { ...i, quantity: clamped } : i);
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
    setQty,
    removeItem,
    clearCart,
  };
}

// ─── usePosCheckout ───────────────────────────────────────────────────────────

/**
 * Ejecuta la venta kiosko mediante el proxy server-side /api/pos/sale.
 *
 * WHY A PROXY (no longer direct SDK RPC):
 *   The Insforge SDK on the browser sometimes holds an edgeFunctionToken
 *   in its HTTP client (set by resetBrowserClient after a localStorage miss).
 *   PostgREST does not recognise edgeFunctionToken as a user context, so
 *   SECURITY DEFINER RPCs fail with "AUTH_INVALID_CREDENTIALS". The proxy
 *   uses the httpOnly pauleam-session cookie server-side — the SDK and
 *   localStorage are NOT involved in the critical write path.
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
      generateInvoice?: boolean;
    }) => {
      setLoading(true);
      setError(null);
      setLastOrderId(null);

      try {
        // Items tal cual los espera el proxy. El proxy valida y sanitiza
        // los rangos antes de invocar process_kiosk_sale server-side.
        const body = {
          customerId:    params.customerId,
          paymentMethod: params.paymentMethod,
          total:         Number(params.total.toFixed(2)),
          invoice:       params.generateInvoice === true,
          items: params.items.map((item) => ({
            product_id:       item.product_id,
            qty_commercial:   Number(item.quantity.toFixed(4)),
            unit_price:       Number(item.price.toFixed(2)),
            conversion_factor: Number((item.conversion_factor ?? 1).toFixed(4)),
          })),
        };

        const res = await fetch("/api/pos/sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "same-origin",
        });

        const result = (await res.json().catch(() => ({}))) as {
          orderId?: string;
          error?: string;
          detail?: string;
        };

        if (!res.ok || !result.orderId) {
          const message = result.error ?? `Error ${res.status} al procesar la venta`;
          throw new Error(result.detail ? `${message} (${result.detail})` : message);
        }

        setLastOrderId(result.orderId);
        return { orderId: result.orderId, error: null };
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
