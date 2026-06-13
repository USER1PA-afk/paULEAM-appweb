import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout — TRACK A ERASER
 *
 * Clears the httpOnly cookies written by /api/auth/set-cookie.
 * JavaScript CANNOT clear httpOnly cookies — this server route is the only way.
 *
 * CRITICAL RULES:
 *   1. Cookie attributes (httpOnly, secure, sameSite, path) MUST be IDENTICAL
 *      to those used in /api/auth/set-cookie. maxAge: 0 is the deletion signal.
 *      Any attribute mismatch → browser treats them as different cookies →
 *      old cookie persists → phantom session that survives logout.
 *   2. Always clear BOTH pauleam-session AND pauleam-role. The proxy fast-path
 *      grants access when both are present; leaving one behind can cause
 *      partial ghost sessions where the proxy redirects to catalog but
 *      the React state shows logged-out UI.
 *   3. This route alone is not enough for full logout. The caller (signOut in
 *      useAuth) must ALSO call insforge.auth.signOut() to clear the SDK
 *      in-memory session, and localStorage.clear() to wipe stored tokens.
 *   4. The /logout page (app/logout/page.tsx) is the emergency escape hatch —
 *      it calls this endpoint + clears all storage + hard-redirects to /login.
 *      It is NOT in the proxy matcher, so it is reachable even with a phantom
 *      session. Do NOT add it to the proxy matcher.
 */
export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  const cookieClear = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pauleam-session", "", cookieClear);
  response.cookies.set("pauleam-role", "", cookieClear);
  return response;
}
