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
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/**
 * Insforge Client — Browser (Client Components)
 *
 * Usa solo la URL pública. No incluye la API key admin.
 * Para operaciones autenticadas, el SDK usa el accessToken
 * del usuario obtenido vía auth.signIn().
 */
export function createBrowserClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error(
      "Faltan variables públicas de Insforge en .env.local"
    );
  }

  return createClient({ baseUrl, anonKey });
}

/**
 * Insforge Client — Server (Server Components, Route Handlers, Server Actions)
 *
 * Incluye la API key admin para operaciones con privilegios elevados.
 * NUNCA importar esta función en componentes de cliente.
 */
export function createServerClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_INSFORGE_URL no está configurada en .env.local"
    );
  }

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
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) return;
  browserClient = createClient({ baseUrl, anonKey, edgeFunctionToken: accessToken });
}
