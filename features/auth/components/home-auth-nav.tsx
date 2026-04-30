"use client";

import Link from "next/link";
import { useAuth, useRole } from "@features/auth/hooks";

export function HomeAuthNav() {
  const { isAuthenticated, signOut, loading } = useAuth();
  const { role } = useRole();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />;
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href={role === "cliente" ? "/shop/catalog" : "/admin/dashboard"}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          {role === "cliente" ? "Ir a la Tienda" : "Ir al Panel"}
        </Link>
        <button
          onClick={signOut}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Iniciar Sesión
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        Registrarse
      </Link>
    </>
  );
}
