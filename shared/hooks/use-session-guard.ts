"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Intercepts fetch responses from the Insforge backend.
 * When a 401 is detected (expired or missing JWT), calls onExpired()
 * to clear auth state, then redirects to /login.
 *
 * Mount this once in protected layout roots (e.g. admin layout).
 */
export function useSessionGuard(onExpired: () => Promise<void>) {
  const router = useRouter();
  const handlingRef = useRef(false);

  useEffect(() => {
    const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
    if (!insforgeUrl) return;

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

    return () => {
      window.fetch = originalFetch;
      handlingRef.current = false;
    };
  }, [onExpired, router]);
}
