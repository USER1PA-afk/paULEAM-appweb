import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * POST /api/storage/upload-receipt
 *
 * Server-side proxy for customer payment receipts.
 * Stores files in the private `payment-receipts` bucket under the
 * authenticated user's folder.
 *
 * Auth: validates `pauleam-session` cookie.
 * Returns: { path: string }
 */

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("pauleam-session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Archivo requerido" },
        { status: 400 }
      );
    }

    const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
    const ALLOWED_MIME_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !ALLOWED_EXTENSIONS.includes(fileExt) ||
      !ALLOWED_MIME_TYPES.includes(file.type)
    ) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF, JPG, PNG o WEBP" },
        { status: 400 }
      );
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 10 MB" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    const apiKey = process.env.INSFORGE_API_KEY;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    // Verify session and obtain user id
    const authClient = createClient({
      baseUrl,
      anonKey: apiKey,
      edgeFunctionToken: sessionToken,
      isServerMode: true,
    });

    const { data: userData, error: authError } = await authClient.auth.getCurrentUser();
    if (authError || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Sesión inválida" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const path = `${userId}/${Date.now()}.${fileExt}`;

    const storageClient = createClient({ baseUrl, anonKey: apiKey });
    const { error: uploadError } = await storageClient.storage
      .from("payment-receipts")
      .upload(path, file);

    if (uploadError) {
      return NextResponse.json(
        { error: (uploadError as { message?: string })?.message ?? "Error al subir archivo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ path });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
