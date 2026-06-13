import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * PROXY — ROUTE PROTECTION MIDDLEWARE (Next.js 16+) — TRACK A
 *
 * Reads httpOnly cookies (pauleam-session + pauleam-role) set by
 * /api/auth/set-cookie to protect routes without touching the SDK.
 *
 * FAST PATH (zero network calls):
 *   Both cookies present and valid → trust immediately. The role cookie is
 *   server-written after JWT verification, so it can be trusted without
 *   a network round-trip to Insforge.
 *
 * FALLBACK PATH (one Insforge network call):
 *   pauleam-session present, pauleam-role missing → resolve role via Insforge.
 *   Only triggers on race conditions (first nav after login) or stale cookies.
 *
 * CRITICAL RULES — DO NOT CHANGE WITHOUT READING ALL OF THESE:
 *
 *   MATCHER: ["/admin", "/admin/:path*", "/login", "/register"]
 *     - /shop/* is NOT here — shop pages render for all; useAuth() handles UI.
 *     - /logout is NOT here — it is the emergency escape hatch and must be
 *       reachable with a phantom session. Adding it would trap stuck users.
 *     - /api/auth/me is NOT here — it must be callable when SDK has no session.
 *
 *   COOKIE TRUST: The role cookie is trusted at face value (fast path).
 *     Both cookies MUST only be written by /api/auth/set-cookie (server-side).
 *     If client JS can write pauleam-role, an attacker can forge admin access.
 *
 *   HARD REDIRECTS: signOut() uses window.location.replace(), not router.push().
 *     router.push() is a soft navigation — the browser does not re-read the
 *     cookie jar before the next request on some mobile browsers. This caused
 *     the phantom session loop. Keep window.location.replace().
 *
 *   LOGIN FLOW: After set-cookie, the login form waits 100ms before navigating.
 *     This gives mobile browsers time to flush Set-Cookie to the cookie jar.
 *     DO NOT remove that delay — it prevents the proxy from seeing a stale
 *     (empty) cookie jar on the first post-login navigation.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken = request.cookies.get("pauleam-session")?.value ?? null;
  const roleCookie   = request.cookies.get("pauleam-role")?.value ?? null;

  const VALID_ROLES = ["admin", "operario", "operator", "sales_kiosk", "cliente"];

  let hasSession = false;
  let userRole: string | null = null;

  if (sessionToken && roleCookie && VALID_ROLES.includes(roleCookie)) {
    // ✅ Fast path — zero network calls
    hasSession = true;
    userRole   = roleCookie;
  } else if (sessionToken) {
    // Fallback: role cookie missing → resolve via Insforge (first login, etc.)
    try {
      const insforge = createClient({
        baseUrl:           process.env.NEXT_PUBLIC_INSFORGE_URL,
        anonKey:           process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_API_KEY,
        edgeFunctionToken: sessionToken,
        isServerMode:      true,
        timeout:           4000,
        retryCount:        0,
      });

      const { data: userData } = await insforge.auth.getCurrentUser();
      const userId = userData?.user?.id;

      if (userId) {
        const { data: profile } = await insforge.database
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        userRole   = (profile as { role: string } | null)?.role ?? null;
        hasSession = !!userRole;
      }
    } catch {
      // If Insforge is unreachable, fail open for non-admin routes
    }
  }

  // --- Protect /admin/* ---
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl, 307);
    }
    const staffRoles = ["admin", "operario", "operator"];
    if (userRole && !staffRoles.includes(userRole)) {
      return NextResponse.redirect(
        new URL(userRole === "sales_kiosk" ? "/pos" : "/shop/catalog", request.url),
        307
      );
    }
  }

  // --- Redirigir desde /login y /register si ya hay sesión ---
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    if (userRole === "cliente") {
      return NextResponse.redirect(new URL("/shop/catalog", request.url), 307);
    }
    if (userRole === "sales_kiosk") {
      return NextResponse.redirect(new URL("/pos", request.url), 307);
    }
    if (userRole === "admin" || userRole === "operario" || userRole === "operator") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url), 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login", "/register"],
};

