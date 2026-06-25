"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { signAndStoreJwt } from "@shared/lib/auth/jwt-integrity";

/**
 * Resolve the authenticated user's role and hard-navigate to their home route.
 *
 * Mirrors the role-based redirect in LoginForm (features/auth/components):
 *   sales_kiosk → /pos · admin|operario → /admin/dashboard · resto → /shop/catalog
 *
 * Uses window.location.replace() (not router.push) so the browser sends a fresh
 * request carrying the pauleam-session httpOnly cookie the proxy depends on, and
 * so the OAuth callback page is dropped from history.
 */
export async function redirectByRole(): Promise<void> {
  let role = "cliente"; // fallback seguro
  try {
    const insforge = getInsforge();
    const { data: userData } = await insforge.auth.getCurrentUser();
    const userId = userData?.user?.id;
    if (userId) {
      const { data: profile } = await insforge.database
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      role = (profile as { role: string } | null)?.role ?? "cliente";
    }
  } catch {
    // Si falla la consulta del rol, usamos 'cliente' (el layout protege /admin).
  }

  // Yield to the browser's cookie-commit microtask queue before navigating.
  // Mobile browsers (Chrome Android) may not flush Set-Cookie synchronously —
  // a 100ms gap prevents the proxy firing before the cookie is readable.
  await new Promise((r) => setTimeout(r, 100));

  if (role === "sales_kiosk") {
    window.location.replace("/pos");
  } else if (role === "admin" || role === "operario") {
    window.location.replace("/admin/dashboard");
  } else {
    window.location.replace("/shop/catalog");
  }
}

/**
 * Establish the session from an access token, then redirect by role.
 *
 * Reuses the exact two-track contract of signIn() in features/auth/hooks:
 *   1. POST /api/auth/set-cookie → Track A httpOnly cookies (throws on !ok).
 *   2. signAndStoreJwt(token)    → Track B signed envelope in localStorage.
 *   3. redirectByRole()          → role-based hard navigation.
 *
 * Used by the Google OAuth callback (app/auth/callback) where the token comes
 * from exchangeOAuthCode() instead of signInWithPassword().
 */
export async function finishLogin(token: string): Promise<void> {
  const cookieRes = await fetch("/api/auth/set-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => null);
  if (!cookieRes?.ok) {
    throw new Error("No se pudo establecer la sesión. Intenta de nuevo.");
  }
  await signAndStoreJwt(token);
  await redirectByRole();
}
