"use client";

import { useEffect, useRef, useState } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import { finishLogin } from "@features/auth/lib/finish-login";

/**
 * Google OAuth callback (PKCE).
 *
 * Insforge redirects here as `?insforge_code=...` after the Google consent.
 *
 * CRITICAL — auto-detect race:
 *   The Insforge SDK runs detectAuthCallback() in its constructor and, if it
 *   sees `insforge_code` in the URL, exchanges it itself — consuming the
 *   single-use code WITHOUT handing us the accessToken (Auth exposes no public
 *   token getter). We need the raw token for Track A (/api/auth/set-cookie).
 *   So we capture the code and STRIP it from the URL BEFORE the first
 *   getInsforge() call, then exchange it ourselves to read data.accessToken.
 */
export default function AuthCallbackPage() {
  const ran = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ran.current) return; // guard StrictMode double-invoke (code is single-use)
    ran.current = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("insforge_code");
        const oauthError = url.searchParams.get("error");

        if (oauthError || !code) {
          setFailed(true);
          return;
        }

        // Strip the code BEFORE constructing the SDK so its auto detectAuthCallback
        // doesn't consume the single-use code first.
        url.searchParams.delete("insforge_code");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);

        const insforge = getInsforge();
        const { data, error } = await insforge.auth.exchangeOAuthCode(code);
        const token = data?.accessToken;
        if (error || !token) {
          setFailed(true);
          return;
        }

        // Best-effort: fill profiles.full_name from the Google display name when
        // the handle_new_user trigger left it as the email (first-time OAuth user).
        try {
          const name = data.user?.profile?.name;
          const userId = data.user?.id;
          if (name && userId) {
            const { data: profile } = await insforge.database
              .from("profiles")
              .select("full_name, email")
              .eq("id", userId)
              .single();
            const p = profile as { full_name?: string; email?: string } | null;
            if (p && (!p.full_name || p.full_name === p.email)) {
              await insforge.database
                .from("profiles")
                .update({ full_name: name })
                .eq("id", userId);
            }
          }
        } catch {
          /* non-blocking — el nombre se puede editar luego */
        }

        await finishLogin(token);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {failed ? (
        <>
          <p className="text-sm text-destructive">
            No se pudo completar el inicio de sesión con Google.
          </p>
          <a
            href="/login"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            Volver a iniciar sesión
          </a>
        </>
      ) : (
        <>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand-600"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Conectando con Google…</p>
        </>
      )}
    </div>
  );
}
