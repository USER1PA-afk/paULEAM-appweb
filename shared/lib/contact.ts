// Número de WhatsApp en formato wa.me: solo dígitos, con código de país, SIN "+",
// espacios ni guiones. Número de pruebas del usuario; cambiar por el del negocio.
export const WHATSAPP_NUMBER = "593980961092";

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hola, quiero más información sobre los productos de PAuleam.";

/** Construye el enlace de chat directo a WhatsApp con un mensaje prellenado. */
export function whatsappUrl(message: string = WHATSAPP_DEFAULT_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
