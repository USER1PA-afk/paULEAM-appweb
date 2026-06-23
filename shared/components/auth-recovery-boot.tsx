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
const RECOVERY_FLAG     = "pauleam_auth_recovery_v1";
const SUPPRESS_FLAG     = "pauleam_console_filter_v1";
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
        if (sessionStorage.getItem(RECOVERY_FLAG) === "1") {
          return new Response(JSON.stringify({ error: "session_recovered" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        sessionStorage.setItem(RECOVERY_FLAG, "1");

        console.warn(
          "[auth-recovery] Stale refresh token detected (HTTP " +
            response.status +
            "). Nuking local SDK session and reloading…"
        );

        try {
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
