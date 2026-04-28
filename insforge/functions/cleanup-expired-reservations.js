/**
 * Edge Function: cleanup-expired-reservations
 *
 * Cron Job que se ejecuta cada minuto para eliminar reservas de stock
 * expiradas y devolver el inventario a su estado disponible.
 *
 * Se invoca vía Insforge Schedules con cron: "* * * * *"
 */
export default async function handler(req) {
  // Validar que es una invocación autorizada
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Importar el SDK de Insforge
    const { createClient } = await import("@insforge/sdk");

    const insforge = createClient({
      baseUrl: Deno.env.get("INSFORGE_URL") || "",
      anonKey: Deno.env.get("INSFORGE_SERVICE_KEY") || "",
    });

    // Ejecutar la función SQL que limpia reservas expiradas
    const { data, error } = await insforge.database.rpc(
      "cleanup_expired_reservations"
    );

    if (error) {
      console.error("Error limpiando reservas:", error);
      return new Response(
        JSON.stringify({ error: error.message, cleaned: 0 }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const cleaned = data ?? 0;
    console.log(`Reservas expiradas limpiadas: ${cleaned}`);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error en cleanup-expired-reservations:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
