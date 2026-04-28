import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy de autenticación y protección de rutas (Next.js 16+).
 *
 * - Rutas /admin/* requieren sesión activa Y rol staff (admin/operario).
 * - Clientes con sesión son redirigidos a /shop/catalog si intentan entrar a /admin/*.
 * - Sin sesión, redirige a /login con ?redirect=...
 * - /login y /register redirigen según rol si ya hay sesión.
 *
 * Cookie "pauleam-role" la escribe el admin layout client-side
 * para que el proxy pueda tomar decisiones sin JWT verification.
 * La validación real del JWT ocurre en Insforge Auth (servidor).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Detectar sesión activa
  // Evitamos usar .includes("insforge") genérico porque puede haber cookies
  // como insforge-client-id que no representan una sesión autenticada.
  const hasSession = request.cookies.getAll().some(
    (cookie) =>
      cookie.name.includes("-auth-token") ||
      cookie.name.includes("access_token") ||
      cookie.name === "pauleam-role"
  );

  // Cookie de rol escrita por el AdminLayout o ShopLayout al cargar
  const userRole = request.cookies.get("pauleam-role")?.value;

  // --- Proteger /admin/* ---
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Clientes autenticados no tienen acceso al panel admin
    if (userRole === "cliente") {
      return NextResponse.redirect(new URL("/shop/catalog", request.url));
    }
  }

  // --- Redirigir desde /login y /register si ya hay sesión ---
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    if (userRole === "cliente") {
      return NextResponse.redirect(new URL("/shop/catalog", request.url));
    }
    // Staff (admin/operario) o sin rol conocido aún → dashboard
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/register"],
};
