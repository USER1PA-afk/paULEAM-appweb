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

/**
 * Calcula la próxima ventana de entrega semanal.
 * Corte: jueves 5:00 PM hora Ecuador (UTC-5, sin horario de verano).
 * Entrega: viernes siguiente al corte.
 */
export function getNextDeliveryWindow(): { deadline: Date; deliveryDate: Date } {
  const EC_OFFSET = -5 * 60 * 60 * 1000; // UTC-5 en ms
  const ecNow = new Date(Date.now() + EC_OFFSET);

  const dow = ecNow.getUTCDay(); // 0=Dom … 4=Jue
  const h   = ecNow.getUTCHours();

  // Días hasta el próximo jueves; si ya es jueves >= 17h pasa a la semana siguiente
  let daysToThursday = (4 - dow + 7) % 7;
  if (daysToThursday === 0 && h >= 17) daysToThursday = 7;

  const thursdayEC = new Date(ecNow.getTime());
  thursdayEC.setUTCDate(ecNow.getUTCDate() + daysToThursday);
  thursdayEC.setUTCHours(17, 0, 0, 0);

  const fridayEC = new Date(thursdayEC.getTime());
  fridayEC.setUTCDate(thursdayEC.getUTCDate() + 1);
  fridayEC.setUTCHours(0, 0, 0, 0);

  return {
    deadline:     new Date(thursdayEC.getTime() - EC_OFFSET),
    deliveryDate: new Date(fridayEC.getTime()   - EC_OFFSET),
  };
}
