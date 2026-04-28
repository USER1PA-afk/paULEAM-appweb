/**
 * Shared Lib
 *
 * Utilidades generales: formatters, constantes, helpers.
 */

/**
 * Formatea un número como moneda ecuatoriana (USD).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea una fecha ISO como fecha legible en español.
 */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

/**
 * Utility para combinar classNames (cn).
 * Reemplaza clsx + tailwind-merge en configuraciones mínimas.
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
