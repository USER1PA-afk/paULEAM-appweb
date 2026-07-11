"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import {
  DeletionRequest,
  DeletionRequestWithRequester,
  DeletionEntityType,
} from "@entities/deletion-request";

/**
 * Hook: submit a deletion request for a product / supplier / recipe.
 * Calls the SECURITY DEFINER RPC `request_entity_deletion`.
 */
export function useRequestDeletion() {
  const insforge = getInsforge();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestDeletion = useCallback(
    async (entityType: DeletionEntityType, entityId: string, reason?: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await insforge.database.rpc(
          "request_entity_deletion",
          {
            p_entity_type: entityType,
            p_entity_id:   entityId,
            p_reason:      reason ?? null,
          }
        );
        if (rpcErr) throw rpcErr;
        return { data: data as string | null, error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al solicitar eliminación";
        setError(msg);
        return { data: null, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { requestDeletion, loading, error };
}

/**
 * Hook: admin-side list of deletion requests, filterable by status.
 * Joins with profiles to get the requester's name.
 */
export function useDeletionRequests(status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL") {
  const insforge = getInsforge();
  const [requests, setRequests] = useState<DeletionRequestWithRequester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = insforge.database
        .from("deletion_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (status && status !== "ALL") {
        q = q.eq("status", status);
      }
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;

      const rows = (data as DeletionRequest[]) ?? [];
      const requesterIds = [...new Set(rows.map((r) => r.requested_by))];
      const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (requesterIds.length > 0) {
        const { data: profs } = await insforge.database
          .from("profiles")
          .select("id, full_name, email")
          .in("id", requesterIds);
        ((profs as { id: string; full_name: string | null; email: string | null }[]) ?? []).forEach(
          (p) => {
            profileMap[p.id] = { full_name: p.full_name, email: p.email };
          }
        );
      }

      setRequests(
        rows.map((r) => ({
          ...r,
          requester_name:  profileMap[r.requested_by]?.full_name ?? null,
          requester_email: profileMap[r.requested_by]?.email ?? null,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [insforge, status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests };
}

/**
 * Hook: admin approve / reject. Calls the corresponding RPC.
 */
export function useReviewDeletionRequest() {
  const insforge = getInsforge();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(
    async (requestId: string, note?: string) => {
      setLoading(true);
      setError(null);
      try {
        const { error: rpcErr } = await insforge.database.rpc(
          "approve_deletion_request",
          { p_request_id: requestId, p_note: note ?? null }
        );
        if (rpcErr) throw rpcErr;
        return { error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al aprobar";
        setError(msg);
        return { error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  const reject = useCallback(
    async (requestId: string, note?: string) => {
      setLoading(true);
      setError(null);
      try {
        const { error: rpcErr } = await insforge.database.rpc(
          "reject_deletion_request",
          { p_request_id: requestId, p_note: note ?? null }
        );
        if (rpcErr) throw rpcErr;
        return { error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al rechazar";
        setError(msg);
        return { error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { approve, reject, loading, error };
}
