"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { useScalePreview } from "../hooks";
import { formatScaledQuantity } from "../lib";
import { Check, X, ArrowDown, ArrowUp } from "lucide-react";
import { usePackagingPreview } from "@features/packaging";

// ── Packaging cost sub-components ──────────────────────────────────────────

interface PackagingPreviewItemProps {
  templateId: string;
  units: number;
  onCostChange: (cost: number) => void;
}

function PackagingPreviewItem({ templateId, units, onCostChange }: PackagingPreviewItemProps) {
  const { preview, loading, error } = usePackagingPreview(templateId, units);
  const prevCostRef = useRef<number>(-1);

  useEffect(() => {
    const cost = preview?.estimated_packaging_cost ?? 0;
    if (cost !== prevCostRef.current) {
      prevCostRef.current = cost;
      onCostChange(cost);
    }
  }, [preview?.estimated_packaging_cost, onCostChange]);

  useEffect(() => {
    return () => {
      prevCostRef.current = -1;
      onCostChange(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  if (loading) {
    return (
      <div className="py-2 text-xs text-muted-foreground flex items-center gap-2">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 shrink-0" />
        Calculando materiales...
      </div>
    );
  }

  if (error) return <div className="py-1 text-xs text-destructive">{error}</div>;
  if (!preview) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">
        {preview.template.name}
        <span className="ml-2 font-normal text-muted-foreground">
          ({units} {preview.template.output_unit})
        </span>
      </p>
      {preview.materials.length > 0 ? (
        <ul className="space-y-0.5 pl-3">
          {preview.materials.map((mat) => (
            <li key={mat.material_product_id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{mat.material_name}</span>
              <span className="tabular-nums">
                {mat.quantity_needed.toLocaleString("es-EC", { maximumFractionDigits: 4 })} {mat.unit}
                {mat.cost_per_unit > 0 && (
                  <span className="ml-2 text-foreground">${mat.estimated_cost.toFixed(2)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pl-3 text-xs text-muted-foreground italic">Sin materiales configurados</p>
      )}
      {preview.estimated_packaging_cost > 0 && (
        <div className="flex items-center justify-between pl-3 pt-1 border-t border-border/40 text-xs">
          <span className="text-muted-foreground">Subtotal materiales</span>
          <span className="font-semibold tabular-nums">${preview.estimated_packaging_cost.toFixed(2)}</span>
        </div>
      )}
      {!preview.can_package && (
        <p className="pl-3 text-[10px] text-amber-600">⚠ Stock insuficiente para empacar</p>
      )}
    </div>
  );
}

interface PackagingCostSectionProps {
  selections: { templateId: string; units: number }[];
  productionCost: number;
}

function PackagingCostSection({ selections, productionCost }: PackagingCostSectionProps) {
  const [costMap, setCostMap] = useState<Record<string, number>>({});

  const handleCostChange = useCallback((templateId: string, cost: number) => {
    setCostMap((prev) => {
      if (prev[templateId] === cost) return prev;
      return { ...prev, [templateId]: cost };
    });
  }, []);

  useEffect(() => {
    const activeIds = new Set(selections.map((s) => s.templateId));
    setCostMap((prev) => {
      const filtered = Object.fromEntries(
        Object.entries(prev).filter(([id]) => activeIds.has(id))
      );
      if (Object.keys(filtered).length === Object.keys(prev).length) return prev;
      return filtered;
    });
  }, [selections]);

  const totalPackaging = Object.values(costMap).reduce((sum, c) => sum + c, 0);
  const grandTotal = productionCost + totalPackaging;

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Materiales de Empaque
      </p>
      <div className="space-y-3">
        {selections.map((sel) => (
          <PackagingPreviewItem
            key={sel.templateId}
            templateId={sel.templateId}
            units={sel.units}
            onCostChange={(cost) => handleCostChange(sel.templateId, cost)}
          />
        ))}
      </div>
      <div className="space-y-1.5 rounded-lg bg-muted/40 border border-border/50 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Costo ingredientes</span>
          <span className="tabular-nums text-foreground">
            {productionCost.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Costo materiales de empaque</span>
          <span className="tabular-nums text-foreground">
            {totalPackaging.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="border-t border-border/60 my-1" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total estimado</span>
          <span className="text-sm font-bold tabular-nums text-brand-700">
            {grandTotal.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

interface ProductionScalePreviewProps {
  recipeId: string | null;
  targetYield: number;
  packagingSelections?: { templateId: string; units: number }[];
}

/**
 * Componente: Preview de Escalado de Producción
 *
 * Muestra la tabla pivote con cantidades base, escaladas y el stock actual.
 */
export function ProductionScalePreview({ recipeId, targetYield, packagingSelections }: ProductionScalePreviewProps) {
  const { recipe, scaleFactor, scaledIngredients, loading, error, canProduce, estimatedCost } = useScalePreview(recipeId, targetYield);

  if (!recipeId) return null;

  if (loading) {
    return (
      <div className="flex justify-center p-6 border rounded-lg bg-card">
        <div role="status" className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando preview de producción...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>;
  }

  if (!recipe) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <h4 className="font-semibold text-foreground">Preview de Producción</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Factor de escala: ×{scaleFactor.toFixed(4)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Objetivo</p>
          <p className="font-bold text-brand-700">{targetYield} {recipe.yield_unit}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table aria-label="Ingredientes requeridos para producción" className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-center font-medium pb-2 pr-4">Ingrediente</th>
              <th className="text-center font-medium pb-2 px-2">Base</th>
              <th className="text-center font-medium pb-2 px-2">Requerido</th>
              <th className="text-center font-medium pb-2 px-2">Stock Disponible</th>
              <th className="text-center font-medium pb-2 px-2">Costo Est.</th>
              <th className="text-center font-medium pb-2 pl-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {scaledIngredients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground italic">
                  Esta receta no tiene ingredientes configurados
                </td>
              </tr>
            ) : (
              scaledIngredients.map((ing) => (
                <tr key={ing.id} className="group">
                  <td className="py-2.5 pr-4 text-center">
                    <div className="font-medium text-foreground text-xs">{ing.product_name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {ing.product_sku}
                      {ing.unit_mismatch && ing.stock_display_unit !== ing.unit && (
                        <span className="text-amber-600 bg-amber-50 px-1 rounded-sm" title={`Receta en ${ing.unit}, stock en ${ing.inventory_unit} — unidades incompatibles`}>
                          ⚠ Unidades distintas
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-xs text-muted-foreground tabular-nums">
                    {Number(ing.base_quantity).toLocaleString("es-EC", {
                      minimumFractionDigits: ["kg", "lt"].includes(ing.unit?.toLowerCase() || "") ? 2 : 0,
                      maximumFractionDigits: ["kg", "lt"].includes(ing.unit?.toLowerCase() || "") ? 2 : 2,
                      useGrouping: false
                    })} {ing.unit}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-foreground tabular-nums">
                    {formatScaledQuantity(ing.scaled_quantity, ing.unit)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-xs text-muted-foreground tabular-nums">
                    {Number(ing.stock_available_normalized).toLocaleString("es-EC", {
                      minimumFractionDigits: ["kg", "lt"].includes(ing.stock_display_unit?.toLowerCase() || "") ? 2 : 0,
                      maximumFractionDigits: 4,
                      useGrouping: false
                    })} {ing.stock_display_unit}
                    {ing.unit_mismatch && ing.stock_display_unit === ing.unit && (
                      <span className="block text-[10px] text-muted-foreground/60">({Number(ing.stock_available).toLocaleString("es-EC", { maximumFractionDigits: 4, useGrouping: false })} {ing.inventory_unit})</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center text-xs tabular-nums text-muted-foreground">
                    {ing.cost_per_unit > 0
                      ? `$${ing.scaled_cost.toFixed(2)}`
                      : <span className="opacity-40">—</span>
                    }
                  </td>
                  <td className="py-2.5 pl-4 text-center">
                    {ing.stock_sufficient ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                        <Check aria-hidden="true" className="h-3 w-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                        <X aria-hidden="true" className="h-3 w-3" /> Insuficiente
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {packagingSelections && packagingSelections.length > 0 ? (
        <PackagingCostSection
          selections={packagingSelections}
          productionCost={estimatedCost}
        />
      ) : (
        estimatedCost > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border/50 px-4 py-2.5">
            <span className="text-sm text-muted-foreground font-medium">Costo estimado de materiales</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {estimatedCost.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
            </span>
          </div>
        )
      )}

      {!canProduce && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          <strong>No hay stock suficiente</strong> para producir la cantidad deseada. Por favor, reabastezca los ingredientes marcados en rojo.
        </div>
      )}
    </div>
  );
}



/**
 * Componente: Detalle de orden de producción que muestra el consumo real
 */
export function ProductionOrderDetail({ orderId, completedAt }: { orderId: string, completedAt: string | null }) {
  // Obtenemos los movimientos del ledger que referencian a esta orden
  const [entries, setEntries] = useState<{ id: string; movement_type: string; product_name: string; quantity: number; product_unit: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  const fmtQty = (q: number, unit: string) => {
    const isPhysical = ["kg", "lt"].includes(unit?.toLowerCase() || "");
    return Number(q).toLocaleString("es-EC", {
      minimumFractionDigits: isPhysical ? 2 : 0,
      maximumFractionDigits: isPhysical ? 2 : 2,
      useGrouping: false,
    });
  };

  useEffect(() => {
    if (!orderId || !completedAt) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    insforge.database
      .from("inventory_ledger_view")
      .select("*")
      .eq("reference_type", "PRODUCCION")
      .eq("reference_id", orderId)
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [orderId, completedAt, insforge]);

  if (!completedAt) return null;

  if (loading) {
    return <div className="text-xs text-muted-foreground py-2">Cargando movimientos...</div>;
  }

  if (entries.length === 0) {
    return <div className="text-xs text-muted-foreground py-2 italic">No se encontraron registros de inventario</div>;
  }

  // Separar ingresos (producto terminado) y egresos (materias primas)
  const egresos = entries.filter(e => e.movement_type === 'EGRESO');
  const ingresos = entries.filter(e => e.movement_type === 'INGRESO');

  return (
    <div className="mt-3 bg-muted/30 rounded-lg p-3 border border-border/50 text-sm">
      <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">Movimientos Generados</h5>
      <ul className="space-y-1">
        {egresos.map(e => (
          <li key={e.id} className="flex justify-between items-center text-xs">
            <span className="inline-flex items-center gap-1 text-red-600 font-medium"><ArrowDown aria-hidden="true" className="h-3 w-3 shrink-0" /> {e.product_name}</span>
            <span className="tabular-nums text-muted-foreground">{fmtQty(e.quantity, e.product_unit)} {e.product_unit}</span>
          </li>
        ))}
        {egresos.length > 0 && ingresos.length > 0 && <div aria-hidden="true" className="h-px bg-border/50 my-1" />}
        {ingresos.map(e => (
          <li key={e.id} className="flex justify-between items-center text-xs">
            <span className="inline-flex items-center gap-1 text-green-600 font-medium"><ArrowUp aria-hidden="true" className="h-3 w-3 shrink-0" /> {e.product_name}</span>
            <span className="tabular-nums text-muted-foreground font-semibold">{fmtQty(e.quantity, e.product_unit)} {e.product_unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
