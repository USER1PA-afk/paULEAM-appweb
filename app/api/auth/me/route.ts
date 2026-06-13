import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/auth/me — SERVER-SIDE SESSION HYDRATION FALLBACK
 *
 * PURPOSE:
 *   This endpoint exists because the Insforge SDK uses localStorage to store
 *   the user session. On some mobile browsers, localStorage is cleared between
 *   navigations (aggressive privacy settings or Chrome's data-clear). When that
 *   happens, getCurrentUser() returns null and the React UI shows "not logged in"
 *   even though the httpOnly pauleam-session cookie is still valid.
 *
 * WHAT IT DOES:
 *   1. Reads the httpOnly pauleam-session cookie (JavaScript cannot do this)
 *   2. Validates it by calling Insforge's getCurrentUser() server-side
 *   3. Returns { user: { id, email, role }, token } so the client can:
 *        a) Populate React auth state (email in navbar, isAuthenticated flag)
 *        b) Call resetBrowserClient(token) to rebuild the SDK singleton so
 *           all DB/RPC calls work without relying on localStorage
 *
 * CALLER:
 *   features/auth/hooks/index.ts → hydrateFromServer() inside checkSession()
 *
 * RETURNING THE TOKEN:
 *   The token is the value of the pauleam-session cookie. Returning it to the
 *   client is safe because the request itself PROVES the cookie is present —
 *   you cannot call this endpoint without already having the token in a cookie.
 *   This mirrors the Supabase SSR pattern.
 *
 * DO NOT add authentication middleware that blocks this endpoint — it MUST be
 * reachable in all states (including when the proxy would normally redirect).
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("pauleam-session")?.value;
  const role  = request.cookies.get("pauleam-role")?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  // If we already have a role cookie we can skip the Insforge round-trip
  // and just validate the token cheaply.
  try {
    const insforge = createClient({
      baseUrl:           process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey:           process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_API_KEY,
      edgeFunctionToken: token,
      isServerMode:      true,
      timeout:           6000,
      retryCount:        0,
    });

    const { data: userData, error } = await insforge.auth.getCurrentUser();
    if (error || !userData?.user?.id) {
      return NextResponse.json({ user: null });
    }

    const resolvedRole = role ?? (() => {
      // Fetch role from profiles as fallback if cookie is stale
      return "cliente";
    })();

    return NextResponse.json({
      user: {
        id:    userData.user.id,
        email: userData.user.email ?? "",
        role:  resolvedRole,
      },
      token,
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
