"use client";

import { getInsforge, resetBrowserClient } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { useAuditActions } from "@features/audit/hooks";
import { CART_KEY_PREFIX } from "@features/checkout/hooks";

// Module-level deduplication: HomeAuthNav, HomeMobileNav, and shop/admin layouts
// each mount their own useAuth() + useRole() instances. Without this, every
// instance independently fires GET /api/auth/me when localStorage is cleared
// (mobile, suspension, or first load). One shared promise means one network call
// regardless of how many hook instances mount simultaneously.
type ServerSession = { user: { id: string; email: string; role: string; fullName?: string } | null; token?: string };
let _serverSessionPromise: Promise<ServerSession | null> | null = null;

function fetchServerSession(): Promise<ServerSession | null> {
  if (!_serverSessionPromise) {
    _serverSessionPromise = fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() as Promise<ServerSession> : null)
      .catch(() => null)
      .finally(() => { _serverSessionPromise = null; });
  }
  return _serverSessionPromise;
}

interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: {
    name?: string;
    avatar_url?: string;
  };
  metadata: Record<string, unknown>;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * useAuth — PRIMARY AUTH HOOK (TRACK B)
 *
 * Manages React auth state using the Insforge SDK (localStorage-based session).
 * This is independent from the httpOnly cookie system used by proxy.ts (Track A).
 *
 * SESSION INITIALIZATION — checkSession():
 *   PRIMARY:  insforge.auth.getCurrentUser() — reads from SDK / localStorage.
 *             Timeout: 8 seconds (was 3s — too short for slow mobile networks).
 *   FALLBACK: hydrateFromServer() — called when primary returns null or times out.
 *             Hits GET /api/auth/me which validates the httpOnly cookie server-side
 *             and returns { user, token }. Then calls resetBrowserClient(token) to
 *             rebuild the SDK singleton so DB/RPC calls work without localStorage.
 *
 * WHY THE FALLBACK EXISTS:
 *   On some mobile browsers (Chrome Android with aggressive privacy settings),
 *   localStorage is cleared between page navigations. The SDK loses its session
 *   on every reload. The httpOnly cookie (Track A) survives because it is not
 *   in localStorage. The fallback re-bridges Track A → Track B.
 *
 * signOut() RULES:
 *   - Calls POST /api/auth/logout first (clears httpOnly cookies).
 *   - Then calls insforge.auth.signOut() (clears in-memory SDK session).
 *   - Then calls localStorage.clear() — clears ALL storage except the cart.
 *     DO NOT revert to key-pattern filtering; it missed SDK token key names
 *     and was the original cause of persistent phantom sessions.
 *   - Redirects via window.location.replace() NOT router.push().
 *     router.push() is a soft navigation — mobile browsers may not flush
 *     cleared cookies before the next proxy check, causing redirect loops.
 *
 * signIn() RULES:
 *   - Token is extracted with fallback: accessToken → access_token → session.access_token
 *     The Insforge SDK may return camelCase or snake_case depending on version.
 *   - set-cookie response is checked for ok status. A non-ok response throws
 *     and the user sees the error. DO NOT silently ignore it (was the cause
 *     of silent mobile login failures that left users in redirect loops).
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const insforge = getInsforge();
  const { logEvent } = useAuditActions();

  // Verificar sesión al montar
  //
  // WHY [] deps and not [insforge]:
  //   resetBrowserClient(token) creates a new client object on every call.
  //   If [insforge] were in the deps, the effect would re-run after each
  //   hydrateFromServer() call (which calls resetBrowserClient), which would
  //   call hydrateFromServer() again, creating a new client, re-running the
  //   effect… infinite loop. [] breaks the cycle — we check the session once
  //   on mount. getInsforge() is called inside checkSession() to always get
  //   the current singleton at call time (not a stale closure reference).
  useEffect(() => {
    let active = true;

    async function hydrateFromServer(): Promise<boolean> {
      try {
        const result = await fetchServerSession();
        if (!result?.user || !active) return false;
        if (result.token) resetBrowserClient(result.token);
        setState({
          user: {
            id: result.user.id,
            email: result.user.email,
            emailVerified: true,
            profile: { name: result.user.fullName ?? "" },
            metadata: {},
          } as AuthUser,
          loading: false,
          error: null,
        });
        return true;
      } catch {
        return false;
      }
    }

    async function checkSession() {
      const ins = getInsforge(); // fresh singleton — not the closed-over variable
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 8000)
      );

      try {
        const { data, error } = await Promise.race([
          ins.auth.getCurrentUser(),
          timeoutPromise,
        ]);

        if (!active) return;

        if (error || !data?.user) {
          // SDK returned null — localStorage may be cleared or slow network.
          // Fall back to server-side cookie validation.
          const hydrated = await hydrateFromServer();
          if (!hydrated && active) {
            setState({ user: null, loading: false, error: null });
          }
          return;
        }

        setState({
          user: data.user as unknown as AuthUser,
          loading: false,
          error: null,
        });

        // Silently refresh the httpOnly session cookie so the proxy
        // stays in sync when the SDK refreshes its internal token.
        ins.auth.refreshSession().then((res) => {
          const raw = res?.data as { accessToken?: string; access_token?: string; session?: { access_token?: string } } | null;
          const freshToken = raw?.accessToken ?? raw?.access_token ?? raw?.session?.access_token;
          if (freshToken && active) {
            fetch("/api/auth/set-cookie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: freshToken }),
            }).catch(() => {});
          }
        }).catch(() => {});
      } catch {
        if (!active) return;
        // Timeout or network error — try server fallback before giving up.
        const hydrated = await hydrateFromServer();
        if (!hydrated && active) {
          setState({ user: null, loading: false, error: null });
        }
      }
    }

    checkSession();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          logEvent("LOGIN_FAILED", "auth_session", null, `Login fallido: ${email}`);
          throw error;
        }

        // Set httpOnly session cookie server-side before returning
        const raw = data as { accessToken?: string; access_token?: string; session?: { access_token?: string } } | null;
        const token = raw?.accessToken ?? raw?.access_token ?? raw?.session?.access_token;
        if (token) {
          const cookieRes = await fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => null);
          if (!cookieRes?.ok) {
            throw new Error("No se pudo establecer la sesión. Intenta de nuevo.");
          }
        } else {
          throw new Error("Token de sesión no disponible. Intenta de nuevo.");
        }

        setState({
          user: data?.user as unknown as AuthUser ?? null,
          loading: false,
          error: null,
        });
        logEvent("LOGIN", "auth_session", null, `Inicio de sesión: ${email}`);
        return { data, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error de autenticación";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return { data: null, error: message };
      }
    },
    [insforge, logEvent]
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string, phone?: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data: signUpData, error } = await insforge.auth.signUp({
          email,
          password,
          name,
        });
        if (error) throw error;

        // Insforge requires email verification — do not auto-login
        if (signUpData?.requireEmailVerification) {
          setState({ user: null, loading: false, error: null });
          return { data: null, error: null, requireEmailVerification: true as const };
        }

        // Email auto-confirmed — force immediate login to get real SDK token
        const loginRes = await insforge.auth.signInWithPassword({
          email,
          password,
        });

        if (loginRes.error) throw loginRes.error;

        // Set httpOnly session cookie server-side
        const rawReg = loginRes.data as { accessToken?: string; access_token?: string; session?: { access_token?: string } } | null;
        const regToken = rawReg?.accessToken ?? rawReg?.access_token ?? rawReg?.session?.access_token;
        if (regToken) {
          const regCookieRes = await fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: regToken }),
          }).catch(() => null);
          if (!regCookieRes?.ok) {
            throw new Error("No se pudo establecer la sesión. Intenta de nuevo.");
          }
        } else {
          throw new Error("Token de sesión no disponible. Intenta de nuevo.");
        }

        // Persist phone to profile (trigger only sets full_name and role)
        if (phone) {
          const userId = (loginRes.data?.user as { id?: string } | null)?.id;
          if (userId) {
            await insforge.database.from("profiles").update({ phone }).eq("id", userId);
          }
        }

        // El trigger handle_new_user() crea el perfil con rol 'cliente' por defecto
        setState({
          user: loginRes.data?.user as unknown as AuthUser ?? null,
          loading: false,
          error: null,
        });
        return { data: loginRes.data, error: null, requireEmailVerification: false as const };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error al registrarse";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return { data: null, error: message, requireEmailVerification: false as const };
      }
    },
    [insforge]
  );

  const signOut = useCallback(async (shouldRedirect: boolean = true) => {
    // Registrar antes de cerrar sesión para capturar el user_id activo
    logEvent("LOGOUT", "auth_session", null, "Cierre de sesión");
    try {
      // Clear httpOnly cookies server-side (JS cannot clear httpOnly cookies directly)
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      await insforge.auth.signOut();
    } catch (err) {
      console.warn("Logout warning:", err);
    } finally {
      setState({ user: null, loading: false, error: null });
      if (typeof window !== "undefined") {
        // Preserve theme + any per-user cart keys (pauleam_cart_<userId>).
        // Wipe everything else (catches any SDK token key name) — including
        // the legacy single-key `pauleam_cart` (no suffix) which was the
        // source of the cross-user cart leak.
        const themeSnapshot = localStorage.getItem("theme");
        const cartSnapshots: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CART_KEY_PREFIX)) {
            cartSnapshots[key] = localStorage.getItem(key) ?? "";
          }
        }
        try { localStorage.clear(); } catch { /* ignore */ }
        try { sessionStorage.clear(); } catch { /* ignore */ }
        if (themeSnapshot) localStorage.setItem("theme", themeSnapshot);
        for (const [key, value] of Object.entries(cartSnapshots)) {
          try { localStorage.setItem(key, value); } catch { /* ignore */ }
        }
      }
      if (shouldRedirect) {
        window.location.replace("/");
      }
    }
  }, [insforge, logEvent]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!state.user,
  };
}

/**
 * Hook para obtener el rol del usuario actual.
 */
export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // WHY [] deps and not [insforge]:
  //   Same reason as useAuth — resetBrowserClient creates a new client reference
  //   on every call. [insforge] would cause this effect to be cleaned up and
  //   re-queued on every hydrateFromServer() call in useAuth, setting active=false
  //   before the async DB query completes. The finally block sees active=false and
  //   skips setLoading(false), leaving roleLoading=true forever → spinner stuck.
  //   [] + getInsforge() inside the async function always reads the current singleton.
  useEffect(() => {
    let active = true;
    async function fetchRole() {
      const ins = getInsforge(); // fresh singleton — not a stale closure reference
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      try {
        const { data: userData } = await Promise.race([
          ins.auth.getCurrentUser(),
          timeoutPromise,
        ]);

        if (!active) return;

        if (!userData?.user?.id) {
          // SDK returned null — browser may have cleared localStorage.
          // edgeFunctionToken (set by resetBrowserClient) does not enable
          // getCurrentUser() on the browser SDK (no isServerMode). Fall back
          // to the shared fetchServerSession() — deduped with useAuth's call
          // so concurrent mounts don't each fire a separate network request.
          try {
            const result = await fetchServerSession();
            if (!active) return;
            setRole(result?.user?.role ?? null);
          } catch {
            // server fallback also failed; role stays null
          }
          return;
        }

        const { data } = await Promise.race([
          ins.database
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single(),
          timeoutPromise,
        ]);

        if (!active) return;

        setRole((data as { role: string } | null)?.role ?? null);
      } catch (err) {
        console.warn("La carga de rol falló o expiró:", err);
        if (active) setRole(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchRole();
    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isOperario: role === "operario",
    isCliente: role === "cliente",
    isStaff: role === "admin" || role === "operario",
  };
}
