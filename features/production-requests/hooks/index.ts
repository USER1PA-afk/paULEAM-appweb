"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

export type ProductionRequestStatus =
  | "PROPOSAL"
  | "PENDING_PRODUCTION"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "REJECTED";

export type FulfillmentType = "PICK-UP_IN_PLANT" | "SHIPPING";

export interface ProductionRequest {
  id: string;
  customer_id: string;
  product_id: string;
  quantity_requested: number;
  total_amount: number;
  amount_paid: number;
  status: ProductionRequestStatus;
  receipt_url: string | null;
  rejection_reason: string | null;
  balance_receipt_url: string | null;
  balance_paid_at: string | null;
  fulfillment_type: FulfillmentType;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    conversion_factor: number;
    sales_unit_name: string | null;
    unit: string;
    image_url: string | null;
  } | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface CreateProductionRequestInput {
  product_id: string;
  quantity_requested: number;
  total_amount: number;
  receipt_path: string;
  fulfillment_type: FulfillmentType;
}

export function useProductionRequests() {
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("production_requests")
        .select("*, products(id, name, sku, price, conversion_factor, sales_unit_name, unit, image_url), profiles(full_name, email)")
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setRequests((data as ProductionRequest[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const createRequest = useCallback(
    async (input: CreateProductionRequestInput) => {
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) throw new Error("No autenticado");

        const { data, error: insertErr } = await insforge.database
          .from("production_requests")
          .insert({
            customer_id: userData.user.id,
            product_id: input.product_id,
            quantity_requested: input.quantity_requested,
            total_amount: input.total_amount,
            receipt_url: input.receipt_path,
            fulfillment_type: input.fulfillment_type,
            status: "PROPOSAL",
          })
          .select()
          .single();

        if (insertErr) throw insertErr;
        await fetchRequests();
        return { data: data as ProductionRequest, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Error al crear la solicitud",
        };
      }
    },
    [insforge, fetchRequests]
  );

  const updateStatus = useCallback(
    async (
      requestId: string,
      status: ProductionRequestStatus,
      extra?: { amount_paid?: number; rejection_reason?: string; balance_receipt_url?: string }
    ) => {
      try {
        const payload: Record<string, unknown> = { status };
        if (extra?.amount_paid !== undefined) payload.amount_paid = extra.amount_paid;
        if (extra?.rejection_reason !== undefined) payload.rejection_reason = extra.rejection_reason;
        if (extra?.balance_receipt_url !== undefined) payload.balance_receipt_url = extra.balance_receipt_url;

        const { error: updErr } = await insforge.database
          .from("production_requests")
          .update(payload)
          .eq("id", requestId);

        if (updErr) throw updErr;
        await fetchRequests();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al actualizar estado",
        };
      }
    },
    [insforge, fetchRequests]
  );

  const settleBalance = useCallback(
    async (requestId: string) => {
      try {
        const { error: rpcErr } = await insforge.database.rpc("settle_production_request_balance", {
          p_request_id: requestId,
        });
        if (rpcErr) throw rpcErr;
        await fetchRequests();
        return { error: null };
      } catch (err: unknown) {
        return {
          error: err instanceof Error ? err.message : "Error al liquidar saldo",
        };
      }
    },
    [insforge, fetchRequests]
  );

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
    createRequest,
    updateStatus,
    settleBalance,
  };
}

export function useMyProductionRequests() {
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      if (!userData?.user?.id) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const { data } = await insforge.database
        .from("production_requests")
        .select("*, products(id, name, sku, price, conversion_factor, sales_unit_name, unit, image_url)")
        .eq("customer_id", userData.user.id)
        .order("created_at", { ascending: false });

      setRequests((data as ProductionRequest[]) ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return { requests, loading, refetch: fetchRequests };
}

/**
 * Subir comprobante de pago (anticipo o saldo) al bucket privado.
 * Devuelve la ruta relativa para guardar en la base de datos.
 */
export async function uploadReceipt(file: File): Promise<{ path?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/storage/upload-receipt", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return { error: body?.error ?? `Error ${res.status}` };
    }

    const { path } = await res.json();
    return { path };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error al subir comprobante" };
  }
}
