import { type NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/receipts/[...path]
 *
 * Authenticated server-side proxy for the private `payment-receipts` bucket.
 *
 * Security flow:
 *  1. Extract the Bearer token from the Authorization header (forwarded by
 *     the browser Insforge client from its in-memory session).
 *  2. Create a per-request Insforge server client using `edgeFunctionToken`,
 *     which automatically injects the token into all SDK requests.
 *  3. Call auth.getCurrentUser() — returns null/error → 401.
 *  4. Download the file from the private bucket via storage.download().
 *  5. Return it with correct Content-Type + Content-Disposition.
 *
 * File path encoding:
 *  Files are stored as `{userId}/{timestamp}.{ext}` — the catch-all [...path]
 *  segment reconstructs the full path by joining the segments with "/".
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/receipts/[...path]">
) {
  // ── 1. Reconstruct the storage file path ──────────────────────────────────
  const { path: segments } = await ctx.params;
  if (!segments || segments.length === 0) {
    return new Response("Ruta de archivo requerida", { status: 400 });
  }
  const filePath = segments.join("/");

  // ── 2. Extract Bearer token from Authorization header ─────────────────────
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return new Response(
      JSON.stringify({ error: "No autorizado — sesión requerida" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Create scoped server client with the user's token ──────────────────
  //  `edgeFunctionToken` calls http.setAuthToken() + tokenManager.setAccessToken()
  //  so auth.getCurrentUser() and storage.download() both use this session.
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

  // ── 4. Verify session ─────────────────────────────────────────────────────
  const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
  if (authError || !userData?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Sesión inválida o expirada" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 5. Download the file from the private bucket ──────────────────────────
  const { data: blob, error: storageError } = await insforge.storage
    .from("payment-receipts")
    .download(filePath);

  if (storageError || !blob) {
    console.error("[receipts] Storage download error:", storageError?.message ?? "blob null");
    return new Response(
      JSON.stringify({ error: "Archivo no encontrado o sin acceso" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 6. Infer Content-Type from extension ──────────────────────────────────
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const MIME_MAP: Record<string, string> = {
    pdf:  "application/pdf",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    png:  "image/png",
    webp: "image/webp",
    gif:  "image/gif",
  };
  const contentType = MIME_MAP[ext] ?? blob.type ?? "application/octet-stream";

  // Viewable types open inline; everything else forces download
  const isViewable = contentType.startsWith("image/") || contentType === "application/pdf";
  const disposition = isViewable
    ? `inline; filename="comprobante-pago.${ext || "bin"}"`
    : `attachment; filename="comprobante-pago.${ext || "bin"}"`;

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": disposition,
      // Private — never cache in shared proxies; no-store prevents stale tokens
      "Cache-Control":       "private, no-store",
    },
  });
}
