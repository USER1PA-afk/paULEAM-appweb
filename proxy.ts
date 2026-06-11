import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * Proxy de autenticación y protección de rutas (Next.js 16+).
 *
 * - Rutas /admin/* requieren sesión activa Y rol staff (admin/operario).
 * - Clientes con sesión son redirigidos a /shop/catalog si intentan entrar a /admin/*.
 * - Sin sesión, redirige a /login con ?redirect=...
 * - /login y /register redirigen según rol si ya hay sesión.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Primary: httpOnly session cookie set by /api/auth/set-cookie (server-side only)
  const sessionCookie = request.cookies.get("pauleam-session")?.value ?? null;
  // Fallback: Insforge SDK cookies for backwards compatibility
  const sdkCookie =
    request.cookies
      .getAll()
      .find(
        (c) =>
          c.name.includes("-auth-token") || c.name.includes("access_token")
      )?.value ?? null;

  const token = sessionCookie ?? sdkCookie ?? null;

  let hasSession = false;
  let userRole: string | null = null;

  if (token) {
    try {
      const insforge = createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || process.env.INSFORGE_API_KEY,
        edgeFunctionToken: token,
        isServerMode: true,
      });

      const { data: userData } = await insforge.auth.getCurrentUser();
      const userId = userData?.user?.id;

      if (userId) {
        const { data: profile } = await insforge.database
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        userRole = (profile as { role: string } | null)?.role ?? null;
        hasSession = !!userRole;
      } else {
        hasSession = false;
        userRole = null;
      }
    } catch (error) {
      console.error("Error al obtener sesión/rol en el proxy:", error);
      hasSession = false;
      userRole = null;
    }
  }

  // --- Protect /admin/* ---
  if (pathname.startsWith("/admin")) { 
    // 1. If there is no session, immediately expel to login using 307 
    if (!hasSession) { 
      const loginUrl = new URL("/login", request.url); 
      loginUrl.searchParams.set("redirect", pathname); 
      return NextResponse.redirect(loginUrl, 307); 
    } 

    // 2. If there is a session but the role is not yet resolved, allow temporary passage 
    if (!userRole) { 
      return NextResponse.next(); 
    } 

    // 3. If the role already exists but is NOT authorized, redirect with 307 as appropriate 
    const validRoles = ["admin", "operario", "operator"]; 
    if (!validRoles.includes(userRole)) { 
      if (userRole === "sales_kiosk") { 
        return NextResponse.redirect(new URL("/pos", request.url), 307); 
      } 
      return NextResponse.redirect(new URL("/shop/catalog", request.url), 307); 
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

