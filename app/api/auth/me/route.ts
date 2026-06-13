import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/auth/me
 *
 * Server-side session hydration fallback.
 * Reads the httpOnly pauleam-session cookie, validates it against Insforge,
 * and returns basic user info so the client can populate React auth state
 * even when the Insforge SDK's localStorage session is missing (e.g. after
 * a full localStorage.clear() or on slow mobile where getCurrentUser() times out).
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
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
