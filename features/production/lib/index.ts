import { RecipeIngredient } from "@entities/recipe";
import { ScaledIngredient } from "@entities/production";

/**
 * Constante con todas las unidades de medida soportadas, agrupadas.
 */
export const MEASUREMENT_UNITS = {
  MASA: [
    { value: "kg", label: "Kilogramos (kg)" },
    { value: "g", label: "Gramos (g)" },
    { value: "lb", label: "Libras (lb)" },
    { value: "oz", label: "Onzas (oz)" },
  ],
  VOLUMEN: [
    { value: "lt", label: "Litros (lt)" },
    { value: "ml", label: "Mililitros (ml)" },
    { value: "gal", label: "Galones (gal)" },
  ],
  COCINA: [
    { value: "cucharadas", label: "Cucharadas (cda)" },
    { value: "cucharaditas", label: "Cucharaditas (cdta)" },
    { value: "tazas", label: "Tazas" },
  ],
  CONTEO: [
    { value: "unidades", label: "Unidades (und)" },
  ],
};

/**
 * Calcula el factor de escala.
 * factor = rendimiento_objetivo / rendimiento_base
 */
export function calculateScaleFactor(yieldBase: number, targetYield: number): number {
  if (yieldBase <= 0) return 0;
  return targetYield / yieldBase;
}

/**
 * Formatea una cantidad escalada para la UI.
 * Ejemplo: 4.5455 lt -> "4.55 lt"
 */
export function formatScaledQuantity(quantity: number, unit: string): string {
  const isPhysical = ["kg", "lt"].includes(unit?.toLowerCase() || "");
  const formatted = Number(quantity.toFixed(4)).toLocaleString("es-EC", {
    minimumFractionDigits: isPhysical ? 2 : 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  return `${formatted} ${unit}`;
}

/**
 * Comprueba si hay suficiente stock.
 */
export function isStockSufficient(required: number, available: number): boolean {
  return available >= required;
}

/**
 * Escala ingredientes y valida contra el stock disponible.
 * Incluye ingredient_role y costo por unidad para cálculo de costo total.
 *
 * @param ingredients Lista de ingredientes de la receta
 * @param scaleFactor Factor calculado (targetYield / yieldBase)
 * @param stockMap Mapa de product_id a { stock_actual, unit, name, sku, cost_per_unit }
 */
export function scaleIngredientsWithStock(
  ingredients: RecipeIngredient[],
  scaleFactor: number,
  stockMap: Record<string, {
    stock_actual: number;
    unit: string;
    name: string;
    sku: string;
    cost_per_unit?: number;
  }>
): ScaledIngredient[] {
  return ingredients.map((ing) => {
    const scaledQty = Number((ing.quantity * scaleFactor).toFixed(4));
    const inventoryData = stockMap[ing.product_id];

    const stockAvailable = inventoryData ? Number(inventoryData.stock_actual) : 0;
    const inventoryUnit = inventoryData?.unit || "unknown";
    const productName = inventoryData?.name || "Desconocido";
    const productSku = inventoryData?.sku || "N/A";
    const costPerUnit = inventoryData?.cost_per_unit ?? 0;

    const isSufficient = isStockSufficient(scaledQty, stockAvailable);
    const unitMismatch = ing.unit !== inventoryUnit;

    return {
      id: ing.id,
      product_id: ing.product_id,
      product_name: productName,
      product_sku: productSku,
      ingredient_role: ing.ingredient_role ?? "MATERIA_PRIMA",
      base_quantity: ing.quantity,
      unit: ing.unit,
      inventory_unit: inventoryUnit,
      scaled_quantity: scaledQty,
      stock_available: stockAvailable,
      stock_sufficient: isSufficient,
      unit_mismatch: unitMismatch,
      cost_per_unit: costPerUnit,
      scaled_cost: Number((scaledQty * costPerUnit).toFixed(4)),
    };
  });
}

/**
 * Calcula el costo total de producción como suma de costos escalados.
 */
export function calculateTotalProductionCost(scaledIngredients: ScaledIngredient[]): number {
  return Number(
    scaledIngredients.reduce((sum, ing) => sum + ing.scaled_cost, 0).toFixed(4)
  );
}
