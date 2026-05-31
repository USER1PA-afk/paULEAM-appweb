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
 * Factores de conversión a unidad base (g para masa, ml para volumen).
 */
const UNIT_FACTORS: Record<string, number> = {
  g: 1, kg: 1000, lb: 453.592, oz: 28.3495,
  ml: 1, lt: 1000, gal: 3785.41,
};

/**
 * Devuelve el grupo de medida de una unidad ("MASA" | "VOLUMEN" | null).
 */
function getUnitGroup(unit: string): "MASA" | "VOLUMEN" | null {
  const u = unit.toLowerCase();
  if (["g", "kg", "lb", "oz"].includes(u)) return "MASA";
  if (["ml", "lt", "gal"].includes(u)) return "VOLUMEN";
  return null;
}

/**
 * Convierte una cantidad de `fromUnit` a `toUnit`.
 * Solo funciona si ambas unidades pertenecen al mismo grupo de medida.
 * Devuelve null si no es posible convertir.
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) return value;
  const fromGroup = getUnitGroup(fromUnit);
  const toGroup = getUnitGroup(toUnit);
  if (!fromGroup || fromGroup !== toGroup) return null;
  const fromFactor = UNIT_FACTORS[fromUnit.toLowerCase()];
  const toFactor = UNIT_FACTORS[toUnit.toLowerCase()];
  if (!fromFactor || !toFactor) return null;
  return value * (fromFactor / toFactor);
}

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

    const unitMismatch = ing.unit !== inventoryUnit;

    // Intentar convertir el stock a la unidad de la receta para comparación uniforme
    const converted = unitMismatch ? convertUnit(stockAvailable, inventoryUnit, ing.unit) : null;
    const stockNormalized = converted !== null ? converted : stockAvailable;
    const stockDisplayUnit = converted !== null ? ing.unit : inventoryUnit;

    const isSufficient = isStockSufficient(scaledQty, stockNormalized);

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
      stock_available_normalized: stockNormalized,
      stock_display_unit: stockDisplayUnit,
      stock_sufficient: isSufficient,
      unit_mismatch: unitMismatch,
      cost_per_unit: costPerUnit,
      // Convertir scaledQty a la unidad del inventario antes de calcular el costo.
      // cost_per_unit está expresado en la unidad del inventario (ej: $/kg, $/lt).
      // Si hay mismatch (receta en g, inventario en kg), hay que convertir.
      scaled_cost: (() => {
        if (costPerUnit === 0) return 0;
        const qtyInInventoryUnit = unitMismatch
          ? (convertUnit(scaledQty, ing.unit, inventoryUnit) ?? scaledQty)
          : scaledQty;
        return Number((qtyInInventoryUnit * costPerUnit).toFixed(4));
      })(),
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
