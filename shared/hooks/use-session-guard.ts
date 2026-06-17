"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getInsforge } from "@shared/lib/insforge/client";

/**
 * Intercepts fetch responses from the Insforge backend.
 * When a 401 is detected (expired or missing JWT), calls onExpired()
 * to clear auth state, then redirects to /login.
 *
 * Tracks user activity (clicks, mouse movements, keyboard events, scroll, touch)
 * and refreshes the session when activity is detected. Implements an inactivity
 * timeout that logs out the user after INACTIVITY_TIMEOUT_MS of no activity.
 *
 * Mount this once in protected layout roots (e.g. admin layout).
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_THROTTLE_MS = 60 * 1000; // Refresh at most once per minute

export function useSessionGuard(onExpired: () => Promise<void>) {
  const router = useRouter();
  const handlingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const ins = getInsforge();
      const res = await ins.auth.refreshSession();
      const raw = res?.data as {
        accessToken?: string;
        access_token?: string;
        session?: { access_token?: string };
      } | null;
      const freshToken = raw?.accessToken ?? raw?.access_token ?? raw?.session?.access_token;
      if (freshToken) {
        await fetch("/api/auth/set-cookie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: freshToken }),
        });
      }
    } catch {
      // Silent fail — will be caught by 401 interceptor on next request
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(async () => {
      handlingRef.current = true;
      await onExpired().catch(() => {});
    }, INACTIVITY_TIMEOUT_MS);
  }, [onExpired]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Throttle refresh calls to at most once per minute
    if (now - lastRefreshRef.current >= ACTIVITY_THROTTLE_MS) {
      lastRefreshRef.current = now;
      refreshSession();
    }

    // Reset the inactivity timer on every activity
    resetInactivityTimer();
  }, [refreshSession, resetInactivityTimer]);

  useEffect(() => {
    const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
    if (!insforgeUrl) return;

    // ── 401 interceptor (existing logic) ──────────────────────────────
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);

      if (response.status === 401 && !handlingRef.current) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
            ? args[0].url
            : String(args[0]);

        if (url.startsWith(insforgeUrl)) {
          handlingRef.current = true;
          // Let the Layout handle the redirect via auth state changes.
          // We still call onExpired to clean up cookies/state.
          await onExpired().catch(() => {});
        }
      }

      return response;
    };

    // ── Activity tracking ──────────────────────────────────────────────
    const activityEvents = ["click", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    // Start the inactivity timer
    resetInactivityTimer();

    return () => {
      window.fetch = originalFetch;
      handlingRef.current = false;
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [onExpired, router, handleActivity, resetInactivityTimer]);
}
