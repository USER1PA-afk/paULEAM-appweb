"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth, useRole } from "@features/auth/hooks";
import { ThemeToggle } from "@shared/components/theme-toggle";

export function HomeMobileNav() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, signOut, loading, user } = useAuth();
  const { role } = useRole();

  return (
    <div className="flex sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 space-y-1 shadow-lg">
          <Link
            href="/shop/catalog"
            onClick={() => setOpen(false)}
            className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Tienda
          </Link>

          <div className="pt-1 border-t border-border mt-1 space-y-1">
            {loading ? (
              <div className="h-9 mx-3 animate-pulse rounded-md bg-muted" />
            ) : isAuthenticated ? (
              <>
                {user?.email && (
                  <p className="px-3 py-1 text-xs text-muted-foreground truncate">{user.email}</p>
                )}
                <Link
                  href={role === "cliente" ? "/shop/catalog" : "/admin/dashboard"}
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                >
                  {role === "cliente" ? "Ir a la Tienda" : "Ir al Panel"}
                </Link>
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t border-border mt-1">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
