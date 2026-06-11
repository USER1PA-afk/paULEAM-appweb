import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * Proxy de autenticación y protección de rutas (Next.js 16+).
 *
 * Fast path: lee pauleam-session + pauleam-role (ambas httpOnly, escritas
 * por /api/auth/set-cookie tras verificar el JWT → se puede confiar en ellas).
 * Fallback: si hay token pero no hay rol, hace una llamada a Insforge para
 * resolver el rol (compatibilidad hacia atrás / primera navegación).
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

