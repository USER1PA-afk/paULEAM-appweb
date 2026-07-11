"use client";

import { useEffect } from "react";

/**
 * Hard-logout page. Navigating here directly (even with a phantom session)
 * clears ALL auth state server-side + client-side, then redirects to /login.
 *
 * Use when the normal logout button fails:
 *   → Navigate to: yourdomain.com/logout
 */
export default function LogoutPage() {
  useEffect(() => {
    const nuke = async () => {
      // 1. Clear httpOnly cookies server-side
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});

      // 2. Wipe ALL localStorage (catches any SDK token key names); preserve theme preference
      const themeSnapshot = localStorage.getItem("theme");
      try { localStorage.clear(); } catch { /* ignore */ }
      if (themeSnapshot) { try { localStorage.setItem("theme", themeSnapshot); } catch { /* ignore */ } }

      // 3. Wipe sessionStorage too
      try { sessionStorage.clear(); } catch { /* ignore */ }

      // 4. Hard redirect — forces browser to re-read the cleared cookie jar
      window.location.replace("/login");
    };

    nuke();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cerrando sesión…</p>
      </div>
    </div>
  );
}
