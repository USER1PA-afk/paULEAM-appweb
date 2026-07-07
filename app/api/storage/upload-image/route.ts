import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * Server-side proxy for product image uploads.
 *
 * WHY THIS EXISTS:
 *   The Insforge SDK's `upload()` method uses a presigned URL strategy.
 *   The browser must POST the file to an external storage URL, which can
 *   fail on some environments/networks due to:
 *     1. CORS restrictions (presigned URL on a different origin)
 *     2. Missing/invalid auth tokens in the presigned URL generation
 *     3. Network-level blocks on cross-origin multipart POSTs
 *
 *   By proxying through our own API route, the upload runs server-side
 *   using the admin API key, bypassing all client-side restrictions.
 *
 * AUTH:
 *   The route reads the pauleam-session httpOnly cookie to verify the
 *   caller is an authenticated admin/operario. The actual storage write
 *   uses the server-side Insforge client with INSFORGE_API_KEY.
 *
 * USAGE from client:
 *   POST /api/storage/upload-image
 *   Content-Type: multipart/form-data
 *   Body: { file: File, productId: string }
 *
 *   Returns: { path: string, publicUrl: string }
 */

export async function POST(request: NextRequest) {
  try {
    // ── 1. Verify auth — check session cookie ──────────────────────────
    const sessionToken = request.cookies.get("pauleam-session")?.value;
    const role = request.cookies.get("pauleam-role")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "operario"].includes(role)) {
      return NextResponse.json(
        { error: "Sin permisos para subir imágenes" },
        { status: 403 }
      );
    }

    // ── 2. Parse form data ──────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;

    if (!file || !productId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: file, productId" },
        { status: 400 }
      );
    }

    // Validate file type
    const ALLOWED_MIME = [
      "image/jpeg", "image/png", "image/webp",
      "image/gif", "image/avif",
    ];
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG, WEBP, GIF o AVIF." },
        { status: 400 }
      );
    }

    // Validate file size (10 MB)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera el límite de 10 MB." },
        { status: 400 }
      );
    }

    // ── 3. Upload via server client ─────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    const apiKey = process.env.INSFORGE_API_KEY;

    if (!baseUrl || !apiKey) {
      console.error("[upload-image] Missing INSFORGE env vars");
      return NextResponse.json(
        { error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    const serverClient = createClient({ baseUrl, anonKey: apiKey });

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `products/${productId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await serverClient.storage
      .from("product-images")
      .upload(path, file);

    if (uploadError) {
      console.error("[upload-image] Storage upload error:", uploadError);
      return NextResponse.json(
        { error: (uploadError as { message?: string })?.message ?? "Error al subir archivo" },
        { status: 500 }
      );
    }

    const publicUrl = serverClient.storage
      .from("product-images")
      .getPublicUrl(path);

    return NextResponse.json({ path, publicUrl });
  } catch (err) {
    console.error("[upload-image] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
