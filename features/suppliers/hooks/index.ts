"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import type { Supplier, CreateSupplier, ProductSupplier } from "@entities/supplier";

/**
 * Hook: cargar proveedores activos.
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setSuppliers((data as Supplier[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  return { suppliers, loading, error, refetch: fetchSuppliers };
}

/**
 * Hook: cargar todos los proveedores (incluye inactivos) — admin only.
 */
export function useAllSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("suppliers")
        .select("*")
        .order("name");
      if (qErr) throw qErr;
      setSuppliers((data as Supplier[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  return { suppliers, loading, error, refetch: fetchSuppliers };
}

/**
 * Hook: cargar proveedores vinculados a un producto.
 */
export function useProductSuppliers(productId: string | undefined) {
  const [productSuppliers, setProductSuppliers] = useState<
    (ProductSupplier & { supplier: Supplier })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  const fetch = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("product_suppliers")
        .select("*, supplier:suppliers(*)")
        .eq("product_id", productId)
        .order("is_primary", { ascending: false });
      setProductSuppliers(
        (data as (ProductSupplier & { supplier: Supplier })[]) ?? []
      );
    } finally {
      setLoading(false);
    }
  }, [productId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch(); }, [fetch]);

  return { productSuppliers, loading, refetch: fetch };
}

/**
 * Hook: acciones CRUD de proveedores.
 */
export function useSupplierActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  /** Crear nuevo proveedor */
  const createSupplier = useCallback(
    async (data: CreateSupplier) => {
      setLoading(true);
      setError(null);
      try {
        const { data: result, error: err } = await insforge.database
          .from("suppliers")
          .insert(data)
          .select()
          .single();
        if (err) throw err;
        return { data: result as Supplier, error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al crear proveedor";
        setError(msg);
        return { data: null, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  /** Actualizar proveedor */
  const updateSupplier = useCallback(
    async (id: string, data: Partial<CreateSupplier>) => {
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await insforge.database
          .from("suppliers")
          .update(data)
          .eq("id", id);
        if (err) throw err;
        return { error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al actualizar";
        setError(msg);
        return { error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  /** Togglear is_active */
  const toggleActive = useCallback(
    async (id: string, current: boolean) => {
      return updateSupplier(id, { is_active: !current });
    },
    [updateSupplier]
  );

  /**
   * Vincular proveedores a producto (reemplaza vínculos existentes).
   * selectedIds: lista de IDs de proveedores seleccionados.
   * primaryId: ID del proveedor marcado como principal.
   */
  const linkSuppliersToProduct = useCallback(
    async (productId: string, selectedIds: string[], primaryId: string) => {
      setLoading(true);
      setError(null);
      try {
        // 1. Eliminar vínculos anteriores
        const { error: delErr } = await insforge.database
          .from("product_suppliers")
          .delete()
          .eq("product_id", productId);
        if (delErr) throw delErr;

        // 2. Insertar nuevos vínculos
        const rows = selectedIds.map((sid) => ({
          product_id: productId,
          supplier_id: sid,
          is_primary: sid === primaryId,
        }));
        const { error: insErr } = await insforge.database
          .from("product_suppliers")
          .insert(rows);
        if (insErr) throw insErr;
        return { error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al vincular proveedores";
        setError(msg);
        return { error: msg };
      } finally {
        setLoading(false);
      }
    },
    [insforge]
  );

  return { createSupplier, updateSupplier, toggleActive, linkSuppliersToProduct, loading, error };
}
