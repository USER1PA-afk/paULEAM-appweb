import { createClient } from "@insforge/sdk";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              INSFORGE CLIENT — ARCHITECTURE WARNING                  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  This app uses TWO parallel auth tracks that must stay in sync:      ║
 * ║                                                                      ║
 * ║  TRACK A — httpOnly cookies (pauleam-session + pauleam-role)         ║
 * ║    • Written by /api/auth/set-cookie after every login               ║
 * ║    • Cleared by /api/auth/logout on every logout                     ║
 * ║    • Read ONLY by the proxy middleware (proxy.ts)                    ║
 * ║    • JavaScript CANNOT read these — they are invisible to the SDK    ║
 * ║    • Purpose: protect /admin/* routes without a network call         ║
 * ║                                                                      ║
 * ║  TRACK B — Insforge SDK session (localStorage)                       ║
 * ║    • Written by the SDK after signInWithPassword()                   ║
 * ║    • Read by every hook that calls getInsforge()                     ║
 * ║    • Purpose: authenticated DB/RPC calls from client components      ║
 * ║                                                                      ║
 * ║  PROBLEM: On some mobile browsers localStorage is cleared between    ║
 * ║  page navigations (privacy settings, aggressive Chrome data-clear).  ║
 * ║  Track B breaks → SDK has no session → all DB calls fail.            ║
 * ║                                                                      ║
 * ║  SOLUTION: resetBrowserClient(token) re-creates the singleton with   ║
 * ║  edgeFunctionToken so the SDK sends Authorization: Bearer <token>    ║
 * ║  on every request, bypassing localStorage entirely.                  ║
 * ║  Called by useAuth() when /api/auth/me validates the httpOnly cookie ║
 * ║  and returns the token as a fallback (see features/auth/hooks).      ║
 * ║                                                                      ║
 * ║  DO NOT remove resetBrowserClient — it is the mobile auth fix.      ║
 * ║  DO NOT merge Track A and Track B into one — they serve             ║
 * ║  fundamentally different layers (middleware vs client components).   ║
 * ║                                                                      ║
 * ║  BROWSER BASEURL (cross-origin vs same-origin):                      ║
 * ║    The browser SDK uses window.location.origin + "/api/insforge"    ║
 * ║    so every API call is SAME-ORIGIN. The Next.js rewrite in          ║
 * ║    next.config.ts (/api/insforge/* → Insforge) tunnels the request  ║
 * ║    server-side. This eliminates CORS preflights — Cloudflare's      ║
 * ║    edge was intermittently returning 502 on the Insforge side,      ║
 * ║    and a 502 from a CDN layer carries no Access-Control-Allow-Origin,║
 * ║    which the browser surfaced as a CORS error. The Insforge server  ║
 * ║    itself was fine; the failure was the network layer in front of   ║
 * ║    it. The proxy sidesteps the problem entirely.                     ║
 * ║                                                                      ║
 * ║    Realtime (Socket.IO WebSocket) cannot ride a Next.js rewrite,    ║
 * ║    so the one hook that uses it (useRealtimeStock) constructs its   ║
 * ║    own SDK instance with the real upstream URL via getRealtimeInsforge.║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

function getUpstreamBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL no está configurada en .env.local");
  }
  return baseUrl.replace(/\/+$/, "");
}

function getBrowserBaseUrl(): string {
  // Must be evaluated lazily because window is undefined during SSR.
  // Path matches the Next.js rewrite in next.config.ts.
  if (typeof window === "undefined") return getUpstreamBaseUrl();
  return `${window.location.origin}/api/insforge`;
}

function getAnonKey(): string {
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Faltan variables públicas de Insforge en .env.local");
  }
  return anonKey;
}

/**
 * Browser-only fetch wrapper. Re-inserts the /api/insforge proxy prefix onto
 * URLs the HttpClient builds via `new URL(path, baseUrl)`.
 *
 * WHY THIS IS NEEDED:
 *   The HttpClient's buildUrl() does `new URL(path, this.baseUrl)`. Because
 *   baseUrl ends with "/api/insforge" (the rewrite prefix in next.config.ts)
 *   and `path` is always absolute ("/api/auth/refresh", "/api/storage/...",
 *   etc.), `new URL()` REPLACES the base's pathname. The result is a
 *   same-origin URL like http://localhost:3000/api/auth/refresh — which
 *   bypasses the rewrite and hits our own /api/* routes (which don't exist
 *   for these paths, hence 404s). The fix is to re-insert the proxy prefix
 *   here so the rewrite can tunnel the request to Insforge.
 *
 *   The Database module is unaffected: it builds URLs by string concatenation
 *   (${baseUrl}${endpoint}) and calls global fetch() directly, so it already
 *   produces correct proxied URLs.
 *
 * SCOPE:
 *   This wrapper is only installed on the browser client (createClient's
 *   `fetch` option). It only sees URLs the HttpClient builds — all of which
 *   are intended for the Insforge upstream. It does NOT intercept the user's
 *   own fetch() calls (those use global fetch directly).
 */
function createBrowserFetch(): typeof fetch {
  if (typeof window === "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  const origin = window.location.origin;
  const proxyPrefix = `${origin}/api/insforge`;
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    if (url.startsWith(`${origin}/`) && !url.startsWith(proxyPrefix)) {
      return fetch(`${proxyPrefix}${url.slice(origin.length)}`, init);
    }
    return fetch(input, init);
  }) as typeof fetch;
}

/**
 * Insforge Client — Browser (Client Components)
 *
 * Usa solo la URL pública. No incluye la API key admin.
 * Para operaciones autenticadas, el SDK usa el accessToken
 * del usuario obtenido vía auth.signIn().
 *
 * The baseUrl points at the same-origin Next.js proxy (/api/insforge/*) so
 * no CORS preflight is required. See the architecture note at the top of
 * this file for why. A custom fetch (createBrowserFetch) is installed so the
 * HttpClient's path-replacement behavior still tunnels through the proxy.
 */
export function createBrowserClient() {
  return createClient({
    baseUrl: getBrowserBaseUrl(),
    anonKey: getAnonKey(),
    fetch: createBrowserFetch(),
  });
}

/**
 * Insforge Client — Server (Server Components, Route Handlers, Server Actions)
 *
 * Incluye la API key admin para operaciones con privilegios elevados.
 * NUNCA importar esta función en componentes de cliente.
 *
 * Server-side hits Insforge directly (no CORS on the server) using the admin
 * API key when present. The browser-side proxy in next.config.ts is for the
 * client SDK only.
 */
export function createServerClient() {
  const baseUrl = getUpstreamBaseUrl();
  const apiKey = process.env.INSFORGE_API_KEY;

  return createClient({
    baseUrl,
    ...(apiKey ? { anonKey: apiKey } : {}),
  });
}

/**
 * Singleton del cliente browser para uso en hooks de cliente.
 * Se inicializa lazily para evitar errores en SSR.
 */
let browserClient: ReturnType<typeof createClient> | null = null;

export function getInsforge() {
  if (typeof window === "undefined") {
    return createServerClient();
  }
  if (!browserClient) {
    browserClient = createBrowserClient();
  }
  return browserClient;
}

/**
 * Realtime-only SDK client. The Next.js rewrite in next.config.ts cannot
 * tunnel WebSocket / socket.io upgrades, so the realtime connection must
 * hit the Insforge upstream directly. Only features/inventory/hooks uses
 * this — every other client code path benefits from the same-origin proxy.
 */
let realtimeClient: ReturnType<typeof createClient> | null = null;
export function getRealtimeInsforge() {
  if (typeof window === "undefined") {
    throw new Error("getRealtimeInsforge() must be called in the browser");
  }
  if (!realtimeClient) {
    realtimeClient = createClient({
      baseUrl: getUpstreamBaseUrl(),
      anonKey: getAnonKey(),
    });
  }
  return realtimeClient;
}

/**
 * MOBILE FALLBACK — Re-initializes the browser singleton with an explicit
 * access token obtained from /api/auth/me (server-side cookie validation).
 *
 * WHEN THIS IS CALLED:
 *   useAuth()'s checkSession() calls getCurrentUser(). On mobile browsers
 *   where localStorage was cleared, the SDK returns null. The hook then
 *   calls /api/auth/me which reads the httpOnly cookie and returns the raw
 *   token. resetBrowserClient(token) rebuilds the singleton so every
 *   subsequent getInsforge() call produces an authenticated client.
 *
 * WHY edgeFunctionToken ON THE CLIENT:
 *   edgeFunctionToken adds Authorization: Bearer <token> to every request.
 *   This is the same mechanism the server-side proxy uses. On the client it
 *   replaces localStorage as the auth source for a single page session.
 *
 * SECURITY NOTE:
 *   The token is already in the httpOnly cookie; returning it via /api/auth/me
 *   is safe because that endpoint requires the cookie to be present (the
 *   request proves the caller is already authenticated). This is equivalent
 *   to how Supabase SSR stores access tokens in readable cookies.
 *
 * DO NOT REMOVE THIS FUNCTION — removing it breaks mobile auth.
 */
export function resetBrowserClient(accessToken: string) {
  if (typeof window === "undefined") return;
  browserClient = createClient({
    baseUrl: getBrowserBaseUrl(),
    anonKey: getAnonKey(),
    edgeFunctionToken: accessToken,
    fetch: createBrowserFetch(),
  });
}
