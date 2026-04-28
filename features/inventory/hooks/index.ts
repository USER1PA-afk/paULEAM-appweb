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
        .from("inventory_ledger")
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
 * Se conecta al canal "inventory" y actualiza el stock en vivo
 * cada vez que el backend emite un evento "stock_updated".
 *
 * El backend publica en este canal cuando el trigger de producción
 * o cualquier INSERT en inventory_ledger ocurre.
 *
 * @param onUpdate - Callback que se llama con la entrada actualizada
 */
export function useRealtimeStock(onUpdate: (entry: LedgerEntry) => void) {
  const insforge = getInsforge();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const rt = insforge.realtime;

        rt.on("connect", () => {
          if (mounted) setConnected(true);
        });
        rt.on("disconnect", () => {
          if (mounted) setConnected(false);
        });

        await rt.connect();
        await rt.subscribe("inventory");

        // Escuchar eventos de nuevos movimientos
        rt.on("stock_updated", (msg: unknown) => {
          if (!mounted) return;
          const payload = (msg as { payload?: LedgerEntry })?.payload;
          if (payload) onUpdate(payload);
        });

        // También escuchar el event genérico para INSERT en inventory_ledger
        rt.on("inventory_ledger:INSERT", (msg: unknown) => {
          if (!mounted) return;
          const payload = (msg as { payload?: LedgerEntry })?.payload;
          if (payload) onUpdate(payload);
        });
      } catch {
        // Realtime no disponible en este plan — funciona sin live updates
        if (mounted) setConnected(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      try {
        insforge.realtime.unsubscribe("inventory");
        insforge.realtime.disconnect();
      } catch {
        // silenciar errores de cleanup
      }
    };
  }, [insforge, onUpdate]);

  return { connected };
}
