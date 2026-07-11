/**
 * Edge Function: cleanup-expired-reservations
 *
 * Cron: cada minuto. Elimina filas de `stock_reservations` con
 * `expires_at <= now()` y devuelve el inventario al estado disponible.
 *
 * Auth: requiere header `Authorization: Bearer <API_KEY>`.
 *       El schedule de Insforge resuelve `${{secrets.API_KEY}}` al
 *       enviar la petición, así que ambos lados usan el mismo secreto.
 *
 * NO es el guard de race conditions del carrito — eso vive en
 * `reserve_stock` (`pg_try_advisory_xact_lock`). Esta función solo
 * recolecta basura de reservas expiradas para liberar stock retenido.
 */
export default async function handler(req) {
  // 1. Validar auth
  const authHeader = req.headers.get("authorization");
  const expectedToken = Deno.env.get("API_KEY") ?? "";
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Resolver endpoint y clave de servicio desde el entorno de la función
  const baseUrl =
    Deno.env.get("INSFORGE_BASE_URL") ?? Deno.env.get("INSFORGE_INTERNAL_URL") ?? "";
  const apiKey = Deno.env.get("API_KEY") ?? "";

  if (!baseUrl || !apiKey) {
    return new Response(
      JSON.stringify({
        error: "Missing INSFORGE_BASE_URL / INSFORGE_INTERNAL_URL or API_KEY",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. Llamada directa a la RPC de Postgres vía PostgREST.
    //    Evita el import dinámico de `@insforge/sdk` (bare specifier que
    //    Deno rechaza sin import_map) y la lectura de nombres de env
    //    var inexistentes (INSFORGE_URL / INSFORGE_SERVICE_KEY).
    const rpcRes = await fetch(
      `${baseUrl}/api/database/rpc/cleanup_expired_reservations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          apikey: apiKey,
        },
        body: JSON.stringify({}),
      }
    );

    if (!rpcRes.ok) {
      const text = await rpcRes.text();
      console.error(`RPC failed: ${rpcRes.status} ${text}`);
      return new Response(
        JSON.stringify({ error: `RPC failed: ${rpcRes.status}`, cleaned: 0 }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. PostgREST responde con un array para SETOF / scalar → extraer
    //    el primer elemento si la respuesta es un array; si no, usar tal cual.
    const result = await rpcRes.json();
    let cleaned = 0;
    if (Array.isArray(result)) {
      cleaned = Number(result[0] ?? 0);
    } else if (typeof result === "number") {
      cleaned = result;
    } else if (result && typeof result === "object" && "data" in result) {
      cleaned = Number((result as { data: unknown }).data ?? 0);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleaned,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cleanup-expired-reservations error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
