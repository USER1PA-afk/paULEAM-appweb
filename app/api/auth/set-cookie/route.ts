import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * POST /api/auth/set-cookie
 *
 * Validates a JWT token server-side and sets httpOnly session cookies.
 * Called by the client after a successful signInWithPassword so the token
 * is stored in an httpOnly cookie (not accessible to JS) for proxy protection.
 */
export async function POST(request: Request) {
  let token: string;
  try {
    const body = await request.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_API_KEY;

  if (!baseUrl) {
    return NextResponse.json({ error: "Configuración incompleta" }, { status: 500 });
  }

  const insforge = createClient({
    baseUrl,
    ...(anonKey ? { anonKey } : {}),
    edgeFunctionToken: token,
    isServerMode: true,
  });

  const { data: userData, error: authError } =
    await insforge.auth.getCurrentUser();

  if (authError || !userData?.user?.id) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
  }

  const { data: profile } = await insforge.database
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  const role = (profile as { role: string } | null)?.role ?? "cliente";

  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set("pauleam-session", token, cookieOpts);
  response.cookies.set("pauleam-role", role, cookieOpts);
  return response;
}
