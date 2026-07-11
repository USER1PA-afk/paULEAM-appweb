import { type NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/payment-qr/[...path]
 *
 * Authenticated server-side proxy for the private `payment-qr` bucket.
 * The bucket holds the single Pichincha / DeUna QR image uploaded by an
 * admin; any authenticated user (cliente in the storefront, sales_kiosk at
 * the POS) can read it through this route.
 *
 * Security flow:
 *  1. Token: prefer httpOnly `pauleam-session` cookie; fall back to Bearer header.
 *  2. Create a per-request Insforge server client using `edgeFunctionToken`.
 *  3. Call auth.getCurrentUser() — returns null/error → 401.
 *  4. Storage RLS (`payment-qr read`) already allows any authenticated user
 *     to SELECT rows where bucket = 'payment-qr', so the download itself
 *     is the access-control check.
 *  5. Download the file via the admin storage client (bypasses RLS) and
 *     return it with the correct Content-Type + Content-Disposition + nosniff.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/payment-qr/[...path]">
) {
  // ── 1. Reconstruct the storage file path ──────────────────────────────────
  const { path: segments } = await ctx.params;
  if (!segments || segments.length === 0) {
    return new Response("Ruta de archivo requerida", { status: 400 });
  }
  const filePath = segments.join("/");

  // ── 2. Obtain token: prefer httpOnly session cookie, fall back to Bearer header
  const sessionCookie = _request.cookies.get("pauleam-session")?.value ?? null;
  const authHeader   = _request.headers.get("authorization");
  const bearerToken  = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token        = sessionCookie ?? bearerToken;

  if (!token) {
    return new Response(
      JSON.stringify({ error: "No autorizado — sesión requerida" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Create clients ──────────────────────────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey  = process.env.INSFORGE_API_KEY;

  if (!baseUrl) {
    return new Response("Configuración del servidor incompleta", { status: 500 });
  }

  const insforge = createClient({
    baseUrl,
    ...(apiKey ? { anonKey: apiKey } : {}),
    edgeFunctionToken: token,
    isServerMode: true,
  });

  // Storage client uses only the admin API key — bypasses RLS because the
  // route already verified the caller is authenticated.
  const storageClient = apiKey
    ? createClient({ baseUrl, anonKey: apiKey, isServerMode: true })
    : insforge;

  // ── 4. Verify session ─────────────────────────────────────────────────────
  const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
  if (authError || !userData?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Sesión inválida o expirada" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 5. Download the file from the private bucket ──────────────────────────
  const { data: blob, error: storageError } = await storageClient.storage
    .from("payment-qr")
    .download(filePath);

  if (storageError || !blob) {
    console.error("[payment-qr] Storage download error:", storageError?.message ?? "blob null");
    return new Response(
      JSON.stringify({ error: "Imagen QR no encontrada" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 6. Infer Content-Type from extension ──────────────────────────────────
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const MIME_MAP: Record<string, string> = {
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif:  "image/gif",
    svg:  "image/svg+xml",
  };
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `inline; filename="qr-pichincha.${ext || "bin"}"`,
      "Cache-Control":          "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
