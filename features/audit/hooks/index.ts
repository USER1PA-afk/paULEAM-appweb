"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import type { AuditLog, AuditFilters, AuditAction, AuditEntityType } from "@entities/audit";

const DEFAULT_PAGE_SIZE = 50;

// ============================================================
// Hook: Consultar el log de auditoría con filtros y paginación
// ============================================================
export function useAuditLog(filters: AuditFilters = {}) {
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const insforge = getInsforge();

  const page      = filters.page      ?? 1;
  const page_size = filters.page_size ?? DEFAULT_PAGE_SIZE;
  const from      = (page - 1) * page_size;
  const to        = from + page_size - 1;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = insforge.database
        .from("audit_log_view")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.action)      query = query.eq("action",      filters.action);
      if (filters.entity_type) query = query.eq("entity_type", filters.entity_type);
      if (filters.date_from)   query = query.gte("created_at", filters.date_from);
      if (filters.date_to)     query = query.lte("created_at", filters.date_to + "T23:59:59Z");

      const { data, error: queryError, count } = await query;
      if (queryError) throw queryError;

      setEntries((data as AuditLog[]) ?? []);
      setTotal(count ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar auditoría");
    } finally {
      setLoading(false);
    }
  }, [
    insforge,
    filters.action,
    filters.entity_type,
    filters.date_from,
    filters.date_to,
    from,
    to,
  ]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return {
    entries,
    total,
    loading,
    error,
    refetch: fetchLogs,
    totalPages: Math.ceil(total / page_size),
  };
}

// ============================================================
// Hook: Escribir eventos de auditoría via RPC
// ============================================================
export function useAuditActions() {
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  const logEvent = useCallback(
    async (
      action:     AuditAction,
      entityType: AuditEntityType,
      entityId?:  string | null,
      details?:   string,
      oldValues?: Record<string, unknown> | null,
      newValues?: Record<string, unknown> | null
    ) => {
      setLoading(true);
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        const userId = (userData?.user as { id?: string } | null)?.id ?? null;

        const { error: rpcError } = await insforge.database.rpc("log_audit_event", {
          p_user_id:     userId,
          p_action:      action,
          p_entity_type: entityType,
          p_entity_id:   entityId   ?? null,
          p_old_values:  oldValues  ?? null,
          p_new_values:  newValues  ?? null,
          p_details:     details    ?? null,
        });

        if (rpcError) throw rpcError;
        return { error: null };
      } catch (err: unknown) {
        // Los fallos de auditoría nunca bloquean la operación principal
        console.warn("[audit]", err instanceof Error ? err.message : err);
        return { error: err instanceof Error ? err.message : "Error de auditoría" };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { logEvent, loading };
}
