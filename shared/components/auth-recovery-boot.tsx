"use client";

import { useEffect } from "react";

/**
 * Boot-time recovery for stale Insforge SDK sessions + suppression of
 * expected migration-gap errors.
 *
 * PROBLEM 1 — 403 loop on /api/auth/refresh:
 *   The Insforge SDK stores a refresh_token in localStorage. When the user
 *   signs in via /api/auth/set-cookie (Track A), the httpOnly cookie is
 *   refreshed but the SDK's localStorage copy of the refresh_token is NOT.
 *   On the next page load, getCurrentUser() detects the token is near
 *   expiry → calls POST /api/auth/refresh → gateway returns 403 because
 *   the stored refresh_token was issued by a different Insforge project /
 *   signed with a rotated key / revoked. The SDK retries, retry, retry —
 *   producing the infinite 403 console noise the user reported.
 *
 *   FIX: Patch window.fetch ONCE. On first 401/403 from any URL matching
 *   /api/auth/refresh, nuke localStorage + sessionStorage + every
 *   non-httpOnly cookie that looks like an SDK token, then hard-reload.
 *   The reload lands on /login (no session, no SDK) and the loop stops.
 *
 *   LOOP-BREAKER (recurring 401s after reload):
 *     After the first reload, getCurrentUser() on the new page will AGAIN
 *     call refreshSession() (the SDK does this when localStorage is empty
 *     but an httpOnly refresh cookie still exists on the Insforge side).
 *     If the refresh cookie is genuinely stale, the response is another
 *     401, recovery fires again, reloads, and loops forever. The previous
 *     RECOVERY_FLAG in sessionStorage did not survive because the recovery
 *     itself calls sessionStorage.clear(). Fix:
 *
 *       1. Set a SECOND, persistent flag in a non-httpOnly cookie BEFORE
 *          any clearing. Cookies survive sessionStorage.clear().
 *       2. Call /api/auth/logout (clears our pauleam-* httpOnly cookies
 *          so the proxy stops seeing the user as logged in).
 *       3. Call getInsforge().auth.signOut() (best-effort, clears the
 *          Insforge SDK's own httpOnly refresh cookie on the Insforge
 *          domain — JS cannot clear it directly because it's on a
 *          different origin).
 *     On the next page load, if the cookie flag is set, the patcher
 *     short-circuits with a fake 401 instead of nuking + reloading.
 *     The user just sees the login form.
 *
 * PROBLEM 2 — 400 noise from stock_summary view:
 *   The stock_summary view is hand-curated (CREATE VIEW ... SELECT ...).
 *   New product columns require a manual migration. While the migration is
 *   pending, the 3-tier fallback in usePosProducts handles missing columns
 *   by retrying with fewer columns. But the Insforge SDK logs every 4xx
 *   response to console.error, polluting the console with red error lines
 *   even though the fallback succeeds. Filter them at the console layer
 *   using a string match — narrow enough to never suppress a real error.
 *
 * SCOPE:
 *   - Recovery: only the path "/api/auth/refresh" triggers reload.
 *   - Suppression: only the stock_summary view's 400s are silenced, and
 *     ONLY in dev/prod runs of THIS app. Other 4xx responses (500, 401,
 *     403, 404, network errors) all pass through to the original console.
 */
const RECOVERY_FLAG      = "pauleam_auth_recovery_v1";
const RECOVERY_FLAG_PERSISTENT = "pauleam_auth_recovery_done";
const SUPPRESS_FLAG      = "pauleam_console_filter_v1";
const SDK_TOKEN_PATTERNS = [
  /^insforge\./i,
  /^sb-.*-auth-token$/i, // Supabase-style SDK key (insforge inherits it)
  /^pauleam_session/,
];

// Console error pattern: lines from the Insforge SDK that log a 400 response
// for stock_summary during the migration-gap fallback chain. The substring
// "stock_summary" + "400" is specific enough that a real failure on a
// different table or with a different status code will not be filtered.
const EXPECTED_400 = /stock_summary[\s\S]{0,400}400/;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

function setCookie(name: string, value: string, sameSite: "Lax" | "Strict" | "None" = "Lax", maxAgeSec = 86400): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=${sameSite}${secure}`;
}

export function AuthRecoveryBoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── 1. Console filter for stock_summary 400s ─────────────────────────
    if (sessionStorage.getItem(SUPPRESS_FLAG) !== "1") {
      const originalError = console.error.bind(console);
      console.error = function filteredError(...args: unknown[]) {
        // Inspect the first arg (and second, for Error objects) for our marker.
        const blob = args
          .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : ""))
          .join(" | ");
        if (EXPECTED_400.test(blob)) return;
        originalError(...args);
      };
      sessionStorage.setItem(SUPPRESS_FLAG, "1");
    }

    // ── 2. Fetch patcher for 403 refresh recovery ────────────────────────
    if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const response = await originalFetch(input, init);

      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isRefresh =
        url.includes("/api/auth/refresh") || url.endsWith("/auth/refresh");
      if (!isRefresh) return response;

      if (response.status === 401 || response.status === 403) {
        // Fresh-login guard: if the JS-readable session marker is set, the
        // user has a valid session (set by /api/auth/set-cookie). The refresh
        // 401 is then a side effect of the /api/insforge proxy: the Insforge
        // SDK's httpOnly refresh cookie is set on the upstream origin
        // (insforge.app) and is not forwarded to localhost:3000, so the
        // same-origin refresh request arrives at Insforge without it. DO NOT
        // NUKE — the session is valid, the refresh is just unreachable.
        // Short-circuit with a fake 401 so the SDK gives up and the page
        // renders normally. (pauleam-session itself is httpOnly and invisible
        // to document.cookie — that's why the marker exists.)
        if (getCookie("pauleam-session-marker")) {
          return new Response(
            JSON.stringify({ error: "refresh_skipped_proxy_artifact" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        // Persistent loop-breaker: if recovery already fired on a previous
        // page load (and the cookie is still set), short-circuit so the
        // page can recover naturally instead of reload-looping. Without
        // this, the next page load's getCurrentUser() would also call
        // refreshSession(), get another 401, and re-trigger recovery.
        if (getCookie(RECOVERY_FLAG_PERSISTENT) === "1") {
          return new Response(JSON.stringify({ error: "session_recovered" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        sessionStorage.setItem(RECOVERY_FLAG, "1");
        // Set the persistent flag BEFORE the clears below — cookies survive
        // our sessionStorage.clear() and localStorage.clear() and are
        // readable on the next page load. 24h TTL covers the user session
        // (they will log in again, at which point the flag is no longer
        // needed; the server-side cookies are the source of truth anyway).
        setCookie(RECOVERY_FLAG_PERSISTENT, "1", "Lax", 86400);

        console.warn(
          "[auth-recovery] Stale refresh token detected (HTTP " +
            response.status +
            "). Nuking local SDK session and reloading…"
        );

        try {
          // 1) Tell the Insforge SDK to sign out. This makes a
          //    POST /api/auth/logout to Insforge and clears the SDK's
          //    server-side httpOnly refresh cookie on the Insforge domain.
          //    Without this, the next page load's refreshSession() will
          //    hit Insforge again with the same stale cookie → 401 → loop.
          //    Best-effort: a missing SDK or network blip must not block
          //    the recovery reload.
          try {
            const { getInsforge } = await import("@shared/lib/insforge/client");
            await getInsforge().auth.signOut().catch(() => {});
          } catch {
            /* SDK not initialized on this code path */
          }

          // 2) Clear our own httpOnly cookies (pauleam-session, pauleam-role,
          //    pauleam-jwt-hmac). Without this, the proxy keeps redirecting
          //    /login to /shop/catalog and the loop continues.
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {
            /* network blip — we still reload and the user can re-login */
          }

          // 3) Nuke local client-side state.
          const themeSnapshot = localStorage.getItem("theme");
          localStorage.clear();
          sessionStorage.clear();
          if (themeSnapshot) localStorage.setItem("theme", themeSnapshot);

          for (const cookie of document.cookie.split(";")) {
            const eq = cookie.indexOf("=");
            const name = (eq < 0 ? cookie : cookie.slice(0, eq)).trim();
            if (!name) continue;
            if (SDK_TOKEN_PATTERNS.some((re) => re.test(name))) {
              const expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
              document.cookie = `${name}=; ${expired}; path=/`;
              document.cookie = `${name}=; ${expired}; path=/; domain=${location.hostname}`;
            }
          }
        } catch (err) {
          console.warn("[auth-recovery] cleanup error:", err);
        }

        window.location.replace("/login?reason=session_recovered");
        return new Promise<Response>(() => {});
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
