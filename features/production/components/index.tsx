"use client";

import { useState, useEffect } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { Recipe } from "@entities/recipe";
import { Product } from "@entities/product";
import { useScalePreview, useRecipeIngredients } from "../hooks";
import { formatScaledQuantity, MEASUREMENT_UNITS } from "../lib";
import { Check, X, ArrowDown, ArrowUp } from "lucide-react";

/**
 * Componente: Preview de Escalado de Producción
 * 
 * Muestra la tabla pivote con cantidades base, escaladas y el stock actual.
 */
export function ProductionScalePreview({ recipeId, targetYield }: { recipeId: string | null; targetYield: number }) {
  const { recipe, scaleFactor, scaledIngredients, loading, error, canProduce } = useScalePreview(recipeId, targetYield);

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
              <th className="text-left font-medium pb-2 pr-4">Ingrediente</th>
              <th className="text-right font-medium pb-2 px-2">Base</th>
              <th className="text-right font-medium pb-2 px-2">Requerido</th>
              <th className="text-right font-medium pb-2 px-2">Stock Disponible</th>
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
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-foreground text-xs">{ing.product_name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {ing.product_sku}
                      {ing.unit_mismatch && (
                        <span className="text-blue-600 bg-blue-50 px-1 rounded-sm" title={`Receta en ${ing.unit}, stock en ${ing.inventory_unit}`}>
                          Dif. Unidad
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs text-muted-foreground tabular-nums">
                    {ing.base_quantity} {ing.unit}
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-foreground tabular-nums">
                    {formatScaledQuantity(ing.scaled_quantity, ing.unit)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs text-muted-foreground tabular-nums">
                    {Number(ing.stock_available).toLocaleString("es-EC")} {ing.inventory_unit}
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

      {!canProduce && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive mt-2">
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
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const insforge = getInsforge();

  useEffect(() => {
    if (!orderId || !completedAt) return;
    
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
            <span className="tabular-nums text-muted-foreground">{e.quantity} {e.product_unit}</span>
          </li>
        ))}
        {egresos.length > 0 && ingresos.length > 0 && <div aria-hidden="true" className="h-px bg-border/50 my-1" />}
        {ingresos.map(e => (
          <li key={e.id} className="flex justify-between items-center text-xs">
            <span className="inline-flex items-center gap-1 text-green-600 font-medium"><ArrowUp aria-hidden="true" className="h-3 w-3 shrink-0" /> {e.product_name}</span>
            <span className="tabular-nums text-muted-foreground font-semibold">{e.quantity} {e.product_unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
