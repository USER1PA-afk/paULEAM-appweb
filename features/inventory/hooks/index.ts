"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

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
  supplier_company: string | null;  // de inventory_ledger_view
  supplier_name: string | null;     // de inventory_ledger_view
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
}

/**
 * Hook para consultar el ledger de inventario con filtros.
 */
export function useInventoryLedger(productId?: string) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = insforge.database
        .from("inventory_ledger_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setEntries((data as LedgerEntry[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar ledger");
    } finally {
      setLoading(false);
    }
  }, [productId, insforge]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return { entries, loading, error, refetch: fetchLedger };
}

/**
 * Hook para consultar el resumen de stock (vista stock_summary).
 */
export function useStockSummary() {
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await insforge.database
        .from("stock_summary")
        .select("*");

      if (queryError) throw queryError;
      setSummary((data as StockSummary[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar stock");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
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
 * Degrada silenciosamente si el plan no soporta WebSockets:
 * intenta conectar durante 3 s y aborta sin errores de consola.
 *
 * @param onUpdate - Callback que se llama con la entrada actualizada
 */
export function useRealtimeStock(onUpdate: (entry: LedgerEntry) => void) {
  const insforge = getInsforge();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let subscribed = false;
    let rt: typeof insforge.realtime | null = null;

    // Si el SDK no expone realtime, salir silenciosamente
    if (!insforge.realtime) return;
    rt = insforge.realtime;

    const handleConnect = () => { if (mounted) setConnected(true); };
    const handleDisconnect = () => { if (mounted) setConnected(false); };
    const handleUpdate = (msg: unknown) => {
      if (!mounted) return;
      const payload = (msg as { payload?: LedgerEntry })?.payload;
      if (payload) onUpdate(payload);
    };

    const setup = async () => {
      if (!rt) return;
      try {
        rt.on("connect", handleConnect);
        rt.on("disconnect", handleDisconnect);
        rt.on("stock_updated", handleUpdate);
        rt.on("inventory_ledger:INSERT", handleUpdate);

        // Timeout: si no conecta en 3 s, abortar silenciosamente
        const connectResult = await Promise.race([
          rt.connect(),
          new Promise<"timeout">((res) => setTimeout(() => res("timeout"), 3000)),
        ]);

        if (!mounted || connectResult === "timeout") return;

        await rt.subscribe("inventory");
        subscribed = true;
      } catch {
        // Realtime no disponible en este plan — modo estático sin errores
        if (mounted) setConnected(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (!rt) return;
      try {
        if (subscribed) rt.unsubscribe("inventory");
        rt.off?.("connect", handleConnect);
        rt.off?.("disconnect", handleDisconnect);
        rt.off?.("stock_updated", handleUpdate);
        rt.off?.("inventory_ledger:INSERT", handleUpdate);
        rt.disconnect();
      } catch {
        // Socket ya cerrado — ignorar
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insforge]);

  return { connected };
}

