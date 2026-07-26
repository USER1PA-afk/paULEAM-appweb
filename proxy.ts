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
 * ALSO: generates a per-request CSP nonce and sets it on the `x-nonce`
 * request header. Next.js reads this header and applies the nonce to its
 * inline scripts (HMR bootstrap in dev, framework chunks in prod). The CSP
 * in next.config.ts reads the same nonce from the response and emits
 * `script-src 'self' 'nonce-<value>'` so legitimate scripts run while
 * injected inline scripts are blocked.
 *
 * CRITICAL RULES — DO NOT CHANGE WITHOUT READING ALL OF THESE:
 *
 *   MATCHER: ["/admin", "/admin/:path*", "/login", "/register", "/((?!_next|favicon.ico|sw.js|icons|manifest).*)"]
 *     - Auth checks only fire on /admin, /admin/*, /login, /register.
 *     - Nonce generation fires on every other path the matcher captures
 *       (everything except _next assets, favicon, sw.js, icons, manifest)
 *       so the CSP header can include a valid nonce on every page response.
 *     - /shop/* auth is NOT here — shop pages render for all; useAuth() handles UI.
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

const VALID_ROLES = ["admin", "operario", "operator", "sales_kiosk", "cliente"];

function generateNonce(): string {
  // 16 random bytes → base64url (22 chars). Cryptographically random per request.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Nonce for CSP (runs on every matched request) ───────────────────
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // ── 2. Auth check (only on protected paths) ────────────────────────────
  const sessionToken = request.cookies.get("pauleam-session")?.value ?? null;
  const roleCookie   = request.cookies.get("pauleam-role")?.value ?? null;

  let hasSession = false;
  let userRole: string | null = null;

  if (sessionToken && roleCookie && VALID_ROLES.includes(roleCookie)) {
    hasSession = true;
    userRole   = roleCookie;
  } else if (sessionToken && (pathname.startsWith("/admin") || pathname === "/login" || pathname === "/register")) {
    // Fallback: role cookie missing → resolve via Insforge. Only run this
    // network call on paths where the answer matters. /shop/* and /pos
    // pages render for unauthenticated users; useAuth() handles their UI.
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

  // ── 3. Build the per-request CSP and attach it to the response ────────
  //
  // NOTE on 'unsafe-inline' for script-src: Next.js 16 / Turbopack injects
  // inline scripts in BOTH dev (HMR bootstrap) and production (framework
  // bootstrap, RSC streaming, hydration data). The `x-nonce` header on the
  // request is not reliably applied to those framework scripts in dev, and
  // in prod the application also injects inline scripts (theme bootstrap,
  // early-flicker suppression, etc.) that do not carry a nonce. Hardening
  // to nonce-only CSP requires auditing and noncing every inline script
  // site — tracked separately. For now, the rest of the CSP remains strict:
  //   • no remote script execution (default-src 'self' + script-src)
  //   • no eval in production (dev only)
  //   • no plugins (object-src 'none')
  //   • no framing (frame-ancestors 'none')
  //   • no form-action off-origin
  // These still meaningfully reduce the XSS surface.
  const IS_DEV = process.env.NODE_ENV !== "production";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://*.insforge.app${IS_DEV ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Insforge serves product/receipt images from cdn.insforge.dev (CDN
    // subdomain) in addition to the API host *.insforge.app. Both must be
    // allowlisted for product gallery, receipt previews, etc.
    `img-src 'self' data: blob: https://*.insforge.app https://*.insforge.dev https://cdn.insforge.dev https://*.vercel.app`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    // wss:// MUST be listed explicitly — CSP does not cross-match schemes, so
    // `https://*.insforge.app` alone does not cover the realtime WebSocket
    // (wss://8i4ga35v.us-east.insforge.app/socket.io/...) used by the
    // inventory ledger live updates. The HTTPS rules still cover the API
    // tunnel /api/insforge/* on the same origin.
    `connect-src 'self' https://*.insforge.app https://*.insforge.dev https://*.vercel.app https://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com wss://*.insforge.app`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/login",
    "/register",
    // Capture everything else EXCEPT framework assets + service worker +
    // manifest + icons + the Insforge proxy tunnel. The tunnel only carries
    // API traffic that doesn't need a CSP nonce and shouldn't be wrapped
    // in one (the upstream Insforge response is JSON, not HTML).
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|icons|manifest\\.webmanifest|api/insforge).*)",
  ],
};

