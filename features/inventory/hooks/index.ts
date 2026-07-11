"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { useCachedQuery, invalidateCache } from "@shared/hooks/use-cached-query";

interface LedgerEntry {
  id: string;
  product_id: string;
  lot_id: string | null;
  movement_type: "INGRESO" | "EGRESO";
  quantity: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  supplier_id: string | null;
  supplier_company: string | null;
  supplier_name: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_unit: string | null;
  production_recipe_name: string | null;
  notes: string | null;
  created_at: string;
}

interface StockSummary {
  product_id: string;
  name: string;
  sku: string;
  type: string;
  unit: string;
  stock_actual: number;
  min_stock_alert: number | null;
}

/**
 * Hook para consultar el ledger de inventario con filtros.
 */
export function useInventoryLedger(productId?: string) {
  const insforge = getInsforge();

  const fetchLedger = useCallback(async () => {
    let query = insforge.database
      .from("inventory_ledger_view")
      .select("*")
      .order("created_at", { ascending: false });

    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error: queryError } = await query;
    if (queryError) throw queryError;
    return (data as LedgerEntry[]) ?? [];
  }, [productId, insforge]);

  const { data, loading, error, refetch } = useCachedQuery<LedgerEntry[]>(
    `inventory_ledger:${productId ?? "all"}`,
    fetchLedger
  );

  return { entries: data ?? [], loading, error, refetch };
}

/**
 * Hook para consultar el resumen de stock (vista stock_summary).
 */
export function useStockSummary() {
  const insforge = getInsforge();

  const fetchSummary = useCallback(async () => {
    const { data, error: queryError } = await insforge.database
      .from("stock_summary")
      .select("*");

    if (queryError) throw queryError;
    return (data as StockSummary[]) ?? [];
  }, [insforge]);

  const { data, loading, error, refetch } = useCachedQuery<StockSummary[]>(
    "stock_summary",
    fetchSummary
  );

  return { summary: data ?? [], loading, error, refetch };
}

/**
 * Hook para registrar movimientos de inventario.
 */
export function useInventoryActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const registerMovement = useCallback(
    async (movement: {
      product_id: string;
      lot_id?: string;
      movement_type: "INGRESO" | "EGRESO";
      quantity: number;
      unit_cost?: number;
      reference_type?: string;
      reference_id?: string;
      supplier_id?: string;
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: insertError } = await insforge.database
          .from("inventory_ledger")
          .insert(movement)
          .select();

        if (insertError) throw insertError;
        // El movimiento cambia el balance — descartar caché de stock y ledger.
        invalidateCache("stock_summary", "inventory_ledger");
        return { data, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error al registrar movimiento";
        setError(message);
        return { data: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { registerMovement, loading, error };
}

/**
 * Hook para suscripción Realtime al canal de inventario.
 * Degrada silenciosamente si el plan no soporta WebSockets.
 *
 * Previene el warning "WebSocket is closed before the connection is
 * established" mediante un flag `cancelled` que impide llamar a
 * `disconnect()` si el handshake aún no completó, y mediante
 * `didConnect` que asegura que solo se desconecta lo que ya conectó.
 *
 * @param onUpdate - Callback que se llama con la entrada actualizada
 */
export function useRealtimeStock(onUpdate: (entry: LedgerEntry) => void) {
  const insforge = getInsforge();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Si el SDK no expone realtime, salir silenciosamente
    if (!insforge.realtime) return;

    const rt = insforge.realtime;
    let cancelled = false;   // true cuando el efecto se limpia antes de conectar
    let didConnect = false;  // true solo si connect() completó con éxito
    let subscribed = false;

    const handleConnect    = () => { if (!cancelled) setConnected(true); };
    const handleDisconnect = () => { if (!cancelled) setConnected(false); };
    const handleUpdate     = (msg: unknown) => {
      if (cancelled) return;
      const payload = (msg as { payload?: LedgerEntry })?.payload;
      if (payload) onUpdate(payload);
    };

    rt.on("connect",                 handleConnect);
    rt.on("disconnect",              handleDisconnect);
    rt.on("stock_updated",           handleUpdate);
    rt.on("inventory_ledger:INSERT", handleUpdate);

    const setup = async () => {
      try {
        const result = await Promise.race([
          rt.connect().then(() => "ok" as const),
          new Promise<"timeout">((res) => setTimeout(() => res("timeout"), 4000)),
        ]);

        // Si el componente se desmontó o llegamos al timeout, no continuar
        if (cancelled || result === "timeout") return;

        didConnect = true;
        await rt.subscribe("inventory");
        subscribed = true;
      } catch {
        // Realtime no disponible en este plan — modo estático sin errores
        if (!cancelled) setConnected(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      setConnected(false);

      // Desregistrar listeners siempre
      try {
        rt.off?.("connect",                 handleConnect);
        rt.off?.("disconnect",              handleDisconnect);
        rt.off?.("stock_updated",           handleUpdate);
        rt.off?.("inventory_ledger:INSERT", handleUpdate);
      } catch { /* ignorar */ }

      // Solo desconectar si el handshake ya completó; de lo contrario
      // el socket está en mid-handshake y llamar disconnect() genera el warning.
      if (!didConnect) return;
      try {
        if (subscribed) rt.unsubscribe("inventory");
        rt.disconnect();
      } catch { /* socket ya cerrado */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insforge]);

  return { connected };
}


