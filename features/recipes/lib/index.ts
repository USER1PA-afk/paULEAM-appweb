/**
 * Recipes Lib — Utilidades compartidas del módulo de recetas.
 */

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
};

/**
 * Devuelve todas las unidades como una lista plana.
 */
export function getAllUnits() {
  return Object.values(MEASUREMENT_UNITS).flat();
}

/**
 * Obtiene la etiqueta de una unidad por su valor.
 */
export function getUnitLabel(value: string): string {
  const unit = getAllUnits().find((u) => u.value === value);
  return unit?.label ?? value;
}

/**
 * Crea un paso de instrucción vacío con el número de paso indicado.
 */
export function createEmptyStep(stepNumber: number) {
  return {
    step: stepNumber,
    description: "",
    temperature: "",
    duration: "",
  };
}
