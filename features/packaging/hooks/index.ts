"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import {
  PackagingTemplate,
  PackagingTemplateMaterial,
  PackagingOrder,
  PackagingStatus,
  PackagingOrderPreview,
  PackagingMaterialPreview,
} from "@entities/packaging";

// ============================================================
// Hook: Plantillas de empaque
// ============================================================
export function usePackagingTemplates() {
  const [templates, setTemplates] = useState<PackagingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("packaging_templates")
        .select(`
          *,
          finished_product:products!packaging_templates_finished_product_id_fkey(name, sku),
          output_product:products!packaging_templates_output_product_id_fkey(name, sku)
        `)
        .eq("is_active", true)
        .order("name");

      if (qErr) throw qErr;

      const mapped = ((data as unknown[]) ?? []).map((row: unknown) => {
        const r = row as PackagingTemplate & {
          finished_product?: { name: string; sku: string };
          output_product?: { name: string; sku: string };
        };
        return {
          ...r,
          finished_product_name: r.finished_product?.name,
          finished_product_sku: r.finished_product?.sku,
          output_product_name: r.output_product?.name,
          output_product_sku: r.output_product?.sku,
        } as PackagingTemplate;
      });

      setTemplates(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}

// ============================================================
// Hook: Una plantilla con sus materiales
// ============================================================
export function usePackagingTemplate(templateId: string | null) {
  const [template, setTemplate] = useState<PackagingTemplate | null>(null);
  const [materials, setMaterials] = useState<PackagingTemplateMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchTemplate = useCallback(async () => {
    if (!templateId) {
      setTemplate(null);
      setMaterials([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: tData, error: tErr } = await insforge.database
        .from("packaging_templates")
        .select(`
          *,
          finished_product:products!packaging_templates_finished_product_id_fkey(name, sku),
          output_product:products!packaging_templates_output_product_id_fkey(name, sku)
        `)
        .eq("id", templateId)
        .single();

      if (tErr) throw tErr;

      const r = tData as PackagingTemplate & {
        finished_product?: { name: string; sku: string };
        output_product?: { name: string; sku: string };
      };
      setTemplate({
        ...r,
        finished_product_name: r.finished_product?.name,
        finished_product_sku: r.finished_product?.sku,
        output_product_name: r.output_product?.name,
        output_product_sku: r.output_product?.sku,
      } as PackagingTemplate);

      const { data: mData, error: mErr } = await insforge.database
        .from("packaging_template_materials")
        .select(`
          *,
          material:products!packaging_template_materials_material_product_id_fkey(name, sku)
        `)
        .eq("template_id", templateId);

      if (mErr) throw mErr;

      const mappedMats = ((mData as unknown[]) ?? []).map((row: unknown) => {
        const m = row as PackagingTemplateMaterial & {
          material?: { name: string; sku: string };
        };
        return {
          ...m,
          material_name: m.material?.name,
          material_sku: m.material?.sku,
        } as PackagingTemplateMaterial;
      });

      setMaterials(mappedMats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar plantilla");
    } finally {
      setLoading(false);
    }
  }, [templateId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  return { template, materials, loading, error, refetch: fetchTemplate };
}

// ============================================================
// Hook: Órdenes de empaque
// ============================================================
export function usePackagingOrders() {
  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await insforge.database
        .from("packaging_orders")
        .select(`
          *,
          template:packaging_templates(
            name,
            finished_product:products!packaging_templates_finished_product_id_fkey(name),
            output_product:products!packaging_templates_output_product_id_fkey(name)
          )
        `)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;

      const mapped = ((data as unknown[]) ?? []).map((row: unknown) => {
        const r = row as PackagingOrder & {
          template?: {
            name: string;
            finished_product?: { name: string };
            output_product?: { name: string };
          };
        };
        return {
          ...r,
          template_name: r.template?.name,
          finished_product_name: r.template?.finished_product?.name,
          output_product_name: r.template?.output_product?.name,
        } as PackagingOrder;
      });

      setOrders(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar órdenes de empaque");
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

// ============================================================
// Hook: Acciones sobre órdenes de empaque
// ============================================================
export function usePackagingActions(refetch: () => void) {
  const insforge = getInsforge();

  const createOrder = useCallback(async (order: {
    template_id: string;
    units_to_package: number;
    production_order_id?: string | null;
    batch_number?: string | null;
    notes?: string | null;
  }) => {
    try {
      const { data, error: insertErr } = await insforge.database
        .from("packaging_orders")
        .insert({ ...order, status: "BORRADOR" })
        .select()
        .single();

      if (insertErr) throw insertErr;
      refetch();
      return { data, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "Error al crear orden" };
    }
  }, [insforge, refetch]);

  const updateStatus = useCallback(async (orderId: string, status: PackagingStatus) => {
    try {
      const { error: updErr } = await insforge.database
        .from("packaging_orders")
        .update({ status })
        .eq("id", orderId);

      if (updErr) throw updErr;
      refetch();
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? "Error al actualizar estado";
      return { error: msg };
    }
  }, [insforge, refetch]);

  const completeOrder = useCallback(async (orderId: string) => {
    return updateStatus(orderId, "COMPLETADA");
  }, [updateStatus]);

  const cancelOrder = useCallback(async (orderId: string) => {
    return updateStatus(orderId, "CANCELADA");
  }, [updateStatus]);

  return { createOrder, updateStatus, completeOrder, cancelOrder };
}

// ============================================================
// Hook: Acciones sobre plantillas de empaque
// ============================================================
export function usePackagingTemplateMutations(refetch: () => void) {
  const insforge = getInsforge();

  const createTemplate = useCallback(async (
    templateData: {
      name: string;
      finished_product_id: string;
      output_product_id: string;
      bulk_qty_per_unit: number;
      bulk_unit: string;
      output_unit: string;
      description?: string | null;
    },
    materials: {
      material_product_id: string;
      quantity_per_unit: number;
      unit: string;
      notes?: string | null;
    }[]
  ) => {
    try {
      const { data: newTemplate, error: tErr } = await insforge.database
        .from("packaging_templates")
        .insert(templateData)
        .select()
        .single();

      if (tErr) throw tErr;
      const template = newTemplate as { id: string };

      if (materials.length > 0) {
        const rows = materials.map((m) => ({ ...m, template_id: template.id }));
        const { error: mErr } = await insforge.database
          .from("packaging_template_materials")
          .insert(rows);

        if (mErr) throw mErr;
      }

      refetch();
      return { data: template, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? "Error al crear plantilla";
      return { data: null, error: msg };
    }
  }, [insforge, refetch]);

  const updateTemplate = useCallback(async (
    templateId: string,
    templateData: Partial<{
      name: string;
      finished_product_id: string;
      output_product_id: string;
      bulk_qty_per_unit: number;
      bulk_unit: string;
      output_unit: string;
      description: string | null;
      is_active: boolean;
    }>,
    materials?: {
      material_product_id: string;
      quantity_per_unit: number;
      unit: string;
      notes?: string | null;
    }[]
  ) => {
    try {
      const { error: tErr } = await insforge.database
        .from("packaging_templates")
        .update(templateData)
        .eq("id", templateId);

      if (tErr) throw tErr;

      if (materials !== undefined) {
        // Reemplazar materiales
        const { error: delErr } = await insforge.database
          .from("packaging_template_materials")
          .delete()
          .eq("template_id", templateId);

        if (delErr) throw delErr;

        if (materials.length > 0) {
          const rows = materials.map((m) => ({ ...m, template_id: templateId }));
          const { error: insErr } = await insforge.database
            .from("packaging_template_materials")
            .insert(rows);

          if (insErr) throw insErr;
        }
      }

      refetch();
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? "Error al actualizar plantilla";
      return { error: msg };
    }
  }, [insforge, refetch]);

  return { createTemplate, updateTemplate };
}

// ============================================================
// Hook: Preview de empaque (validación de stock antes de crear/completar)
// ============================================================
export function usePackagingPreview(
  templateId: string | null,
  unitsToPackage: number
) {
  const [preview, setPreview] = useState<PackagingOrderPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();

  useEffect(() => {
    if (!templateId || unitsToPackage <= 0) {
      setPreview(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    async function loadPreview() {
      try {
        // 1. Cargar plantilla con join
        const { data: tData, error: tErr } = await insforge.database
          .from("packaging_templates")
          .select(`
            *,
            finished_product:products!packaging_templates_finished_product_id_fkey(name, sku),
            output_product:products!packaging_templates_output_product_id_fkey(name, sku)
          `)
          .eq("id", templateId)
          .single();

        if (tErr) throw tErr;

        const raw = tData as PackagingTemplate & {
          finished_product?: { name: string; sku: string };
          output_product?: { name: string; sku: string };
        };

        const template: PackagingTemplate = {
          ...raw,
          finished_product_name: raw.finished_product?.name,
          finished_product_sku: raw.finished_product?.sku,
          output_product_name: raw.output_product?.name,
          output_product_sku: raw.output_product?.sku,
        };

        // 2. Cargar materiales
        const { data: mData, error: mErr } = await insforge.database
          .from("packaging_template_materials")
          .select(`
            *,
            material:products!packaging_template_materials_material_product_id_fkey(name, sku)
          `)
          .eq("template_id", templateId);

        if (mErr) throw mErr;

        // 3. Cargar stock del producto a granel
        const { data: bulkStock } = await insforge.database
          .from("stock_summary")
          .select("stock_actual")
          .eq("product_id", template.finished_product_id)
          .single();

        const bulkAvailable = Number((bulkStock as { stock_actual: number } | null)?.stock_actual ?? 0);
        const bulkNeeded = unitsToPackage * template.bulk_qty_per_unit;

        // 4. Cargar stock de materiales
        const materialRows = ((mData as unknown[]) ?? []) as (PackagingTemplateMaterial & {
          material?: { name: string; sku: string };
        })[];

        const materialIds = materialRows.map((m) => m.material_product_id);
        let stockMap: Record<string, number> = {};
        let costMap: Record<string, number> = {};

        if (materialIds.length > 0) {
          const { data: stockData } = await insforge.database
            .from("stock_summary")
            .select("product_id, stock_actual")
            .in("product_id", materialIds);

          (stockData as { product_id: string; stock_actual: number }[] ?? []).forEach((s) => {
            stockMap[s.product_id] = Number(s.stock_actual);
          });

          const { data: costData } = await insforge.database
            .from("products")
            .select("id, cost_per_unit")
            .in("id", materialIds);

          ((costData as { id: string; cost_per_unit: number }[]) ?? []).forEach((c) => {
            costMap[c.id] = c.cost_per_unit ?? 0;
          });
        }

        const materialsPreview: PackagingMaterialPreview[] = materialRows.map((m) => {
          const needed = m.quantity_per_unit * unitsToPackage;
          const available = stockMap[m.material_product_id] ?? 0;
          const costPerUnit = costMap[m.material_product_id] ?? 0;
          return {
            material_product_id: m.material_product_id,
            material_name: m.material?.name ?? "Desconocido",
            material_sku: m.material?.sku ?? "—",
            quantity_needed: needed,
            unit: m.unit,
            stock_available: available,
            stock_sufficient: available >= needed,
            cost_per_unit: costPerUnit,
            estimated_cost: Number((needed * costPerUnit).toFixed(4)),
          };
        });

        const canPackage =
          bulkAvailable >= bulkNeeded &&
          materialsPreview.every((m) => m.stock_sufficient);

        const estimatedPackagingCost = Number(
          materialsPreview.reduce((sum, m) => sum + m.estimated_cost, 0).toFixed(4)
        );

        if (mounted) {
          setPreview({
            template,
            units_to_package: unitsToPackage,
            bulk_qty_consumed: bulkNeeded,
            bulk_stock_available: bulkAvailable,
            bulk_stock_sufficient: bulkAvailable >= bulkNeeded,
            materials: materialsPreview,
            can_package: canPackage,
            estimated_packaging_cost: estimatedPackagingCost,
          });
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Error al calcular preview");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPreview();
    return () => { mounted = false; };
  }, [templateId, unitsToPackage, insforge]);

  return { preview, loading, error };
}

// ============================================================
// Hook: stock pre-check para una lista de órdenes de empaque
// Devuelve un mapa orderId → { canComplete, shortfalls[] }
//   - canComplete=false si bulk < bulk_needed O algún material < material_needed
//   - shortfalls es un array legible para mostrar al usuario
// ============================================================
export interface PackagingShortfall {
  product_id: string;
  product_name: string;
  unit: string;
  required: number;
  available: number;
}

export interface PackagingStockCheck {
  orderId: string;
  canComplete: boolean;
  shortfalls: PackagingShortfall[];
}

export function usePackagingStockCheck(orders: PackagingOrder[]) {
  const insforge = getInsforge();
  const [map, setMap] = useState<Record<string, PackagingStockCheck>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orders.length === 0) {
      setMap({});
      return;
    }

    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        // 1. Cargar todas las plantillas referenciadas (incluyendo materiales)
        const templateIds = [...new Set(orders.map((o) => o.template_id))];
        const { data: tplData } = await insforge.database
          .from("packaging_templates")
          .select(`
            id,
            bulk_qty_per_unit,
            bulk_unit,
            finished_product_id,
            materials:packaging_template_materials(
              material_product_id,
              quantity_per_unit,
              unit
            )
          `)
          .in("id", templateIds);

        type TplRow = {
          id: string;
          bulk_qty_per_unit: number;
          bulk_unit: string;
          finished_product_id: string;
          materials: { material_product_id: string; quantity_per_unit: number; unit: string }[];
        };
        const tplMap: Record<string, TplRow> = {};
        ((tplData as TplRow[]) ?? []).forEach((t) => { tplMap[t.id] = t; });

        // 2. Recolectar product_ids a consultar en stock_summary
        const productIds = new Set<string>();
        Object.values(tplMap).forEach((t) => {
          productIds.add(t.finished_product_id);
          t.materials?.forEach((m) => productIds.add(m.material_product_id));
        });

        // 3. Cargar stock_summary para todos los productos relevantes
        const { data: stockData } = await insforge.database
          .from("stock_summary")
          .select("product_id, name, unit, stock_actual")
          .in("product_id", [...productIds]);
        const stockMap: Record<string, { name: string; unit: string; stock_actual: number }> = {};
        ((stockData as { product_id: string; name: string; unit: string; stock_actual: number }[]) ?? []).forEach(
          (s) => {
            stockMap[s.product_id] = { name: s.name, unit: s.unit, stock_actual: Number(s.stock_actual) };
          }
        );

        // 4. Calcular shortfalls por orden
        const result: Record<string, PackagingStockCheck> = {};
        for (const o of orders) {
          const tpl = tplMap[o.template_id];
          if (!tpl) {
            result[o.id] = { orderId: o.id, canComplete: false, shortfalls: [] };
            continue;
          }

          const shortfalls: PackagingShortfall[] = [];
          const bulkNeeded = Number(o.units_to_package) * Number(tpl.bulk_qty_per_unit);
          const bulk = stockMap[tpl.finished_product_id];
          if (!bulk || bulk.stock_actual < bulkNeeded) {
            shortfalls.push({
              product_id: tpl.finished_product_id,
              product_name: bulk?.name ?? "Producto a granel",
              unit: tpl.bulk_unit,
              required: bulkNeeded,
              available: bulk?.stock_actual ?? 0,
            });
          }
          for (const m of tpl.materials ?? []) {
            const need = Number(o.units_to_package) * Number(m.quantity_per_unit);
            const s = stockMap[m.material_product_id];
            if (!s || s.stock_actual < need) {
              shortfalls.push({
                product_id: m.material_product_id,
                product_name: s?.name ?? "Material",
                unit: m.unit,
                required: need,
                available: s?.stock_actual ?? 0,
              });
            }
          }

          result[o.id] = {
            orderId: o.id,
            canComplete: shortfalls.length === 0,
            shortfalls,
          };
        }

        if (!cancelled) setMap(result);
      } catch {
        if (!cancelled) setMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length, orders.map((o) => `${o.id}:${o.units_to_package}:${o.status}`).join("|"), insforge]);

  return { stockMap: map, loading };
}

// ============================================================
// Hook: Órdenes de empaque por orden de producción
// ============================================================
export function usePackagingOrdersByProduction(productionOrderId: string | null) {
  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  const fetchOrders = useCallback(async () => {
    if (!productionOrderId) { setOrders([]); return; }
    setLoading(true);
    const { data } = await insforge.database
      .from("packaging_orders")
      .select(`
        *,
        template:packaging_templates(
          name,
          finished_product:products!packaging_templates_finished_product_id_fkey(name),
          output_product:products!packaging_templates_output_product_id_fkey(name)
        )
      `)
      .eq("production_order_id", productionOrderId)
      .order("created_at", { ascending: true });

    const mapped = ((data as unknown[]) ?? []).map((row: unknown) => {
      const r = row as PackagingOrder & {
        template?: {
          name: string;
          finished_product?: { name: string };
          output_product?: { name: string };
        };
      };
      return {
        ...r,
        template_name: r.template?.name,
        finished_product_name: r.template?.finished_product?.name,
        output_product_name: r.template?.output_product?.name,
      } as PackagingOrder;
    });
    setOrders(mapped);
    setLoading(false);
  }, [productionOrderId, insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}
