"use client";

import { useEffect, useState } from "react";
import { getInsforge } from "@shared/lib/insforge/client";

/** Official Google "G" mark. */
function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

/**
 * "Continuar con Google" — starts the Insforge PKCE OAuth flow.
 *
 * The SDK generates the PKCE verifier (stored in sessionStorage), then redirects
 * the browser to Google. The round trip returns to /auth/callback, which exchanges
 * the code and establishes the session (see app/auth/callback/page.tsx).
 *
 * The button renders only when Google is enabled for the project
 * (getPublicAuthConfig().oAuthProviders includes "google"), so it stays hidden
 * until the backend provider is configured.
 */
export function GoogleSignInButton({ mode = "login" }: { mode?: "login" | "register" }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getInsforge()
      .auth.getPublicAuthConfig()
      .then(
        ({ data }) => {
          if (active && data?.oAuthProviders?.includes("google")) setEnabled(true);
        },
        () => {
          /* si no se puede leer la config, dejamos el botón oculto */
        }
      );
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  async function handleClick() {
    setLoading(true);
    try {
      const { error } = await getInsforge().auth.signInWithOAuth({
        provider: "google",
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      // On success the SDK redirects the browser to Google — nothing more to do.
      if (error) setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  const label = mode === "register" ? "Registrarse con Google" : "Continuar con Google";

  return (
    <div className="space-y-4">
      <div className="relative flex items-center" aria-hidden="true">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 text-xs uppercase tracking-wide text-muted-foreground">o</span>
        <div className="flex-grow border-t border-border" />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <GoogleIcon />
        {loading ? "Conectando…" : label}
      </button>
    </div>
  );
}
