import { createClient } from "@insforge/sdk";

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
 * Re-initializes the browser singleton with an explicit access token.
 * Called by the auth hook when localStorage is empty (cleared on mobile)
 * but the httpOnly session cookie is still valid. The token-bearing client
 * sends Authorization: Bearer <token> on every request, restoring
 * authenticated DB/RPC access without relying on localStorage.
 */
export function resetBrowserClient(accessToken: string) {
  if (typeof window === "undefined") return;
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) return;
  browserClient = createClient({ baseUrl, anonKey, edgeFunctionToken: accessToken });
}
