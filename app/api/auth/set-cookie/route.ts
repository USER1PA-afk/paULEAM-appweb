import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/set-cookie — TRACK A WRITER
 *
 * Sets the httpOnly auth cookies that Track A (proxy middleware) depends on.
 * Called immediately after every successful signInWithPassword() or signUp().
 *
 * Also sets `pauleam-jwt-hmac` (non-httpOnly) — the per-session secret the
 * browser uses to HMAC the localStorage JWT envelope. See
 * shared/lib/auth/jwt-integrity.ts for what this does and does not protect.
 *
 * CRITICAL RULES:
 *   1. BOTH cookies (pauleam-session AND pauleam-role) must always be set
 *      together. The proxy fast-path requires both present and valid.
 *   2. Cookie options (httpOnly, secure, sameSite, path, maxAge) MUST match
 *      exactly what /api/auth/logout uses to clear them. A mismatch in any
 *      attribute means logout cannot delete the cookie (browser treats them
 *      as different cookies).
 *   3. This endpoint returns 401 if Insforge token validation fails.
 *      The caller (signIn in useAuth) treats a non-ok response as a hard
 *      error shown to the user. DO NOT revert to silently ignoring the
 *      response — that was the original cause of phantom sessions on mobile.
 *   4. The 100ms delay before window.location.href in the login form exists
 *      to give mobile browsers time to flush Set-Cookie headers to the cookie
 *      jar before the next navigation fires. DO NOT remove it.
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

  // Per-session HMAC secret for the localStorage JWT envelope. Regenerated
  // on every login. The cookie is intentionally NOT httpOnly — the browser
  // needs to read it to compute the HMAC. See shared/lib/auth/jwt-integrity.ts
  // for the security analysis of this trade-off.
  const hmacSecret = randomBytes(32).toString("base64url");
  const hmacCookieOpts = {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set("pauleam-session", token, cookieOpts);
  response.cookies.set("pauleam-role", role, cookieOpts);
  response.cookies.set("pauleam-jwt-hmac", hmacSecret, hmacCookieOpts);
  return response;
}
