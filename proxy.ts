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

  // Detectar cookie de sesión activa de Insforge (access_token o *-auth-token)
  const tokenCookie = request.cookies.getAll().find(
    (cookie) =>
      cookie.name.includes("-auth-token") ||
      cookie.name.includes("access_token")
  );
  const token = tokenCookie?.value;

  let hasSession = !!token;
  let userRole: string | null = null;

  // Fast path: role cookie set by the admin layout after client-side role fetch.
  // The SDK stores tokens in localStorage (not cookies), so the token cookie is
  // absent on most navigations. The role cookie is our server-readable signal.
  const roleCookie = request.cookies.get("pauleam-role")?.value ?? null;
  const validRoleValues = ["admin", "operario", "operator", "sales_kiosk", "cliente"];
  if (!token && roleCookie && validRoleValues.includes(roleCookie)) {
    hasSession = true;
    userRole = roleCookie;
  }

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

  // Escape hatch: first navigation after login before the layout has a chance
  // to set the pauleam-role cookie. Without this the post-login redirect to
  // /admin/dashboard would itself get kicked back to /login.
  if (!hasSession) {
    const referer = request.headers.get("referer") ?? "";
    if (referer.endsWith("/login") || referer.endsWith("/register")) {
      return NextResponse.next();
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

