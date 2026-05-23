"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useEffect } from "react";
import { LogOut, Monitor, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@shared/components/theme-toggle";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (role && role !== "sales_kiosk" && role !== "admin") {
      // Redirigir al panel correcto según el rol
      if (role === "cliente") router.replace("/shop/catalog");
      else router.replace("/admin/dashboard");
    }
  }, [authLoading, roleLoading, isAuthenticated, role, router]);

  // Loading state
  if (authLoading || (isAuthenticated && roleLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 dark:border-brand-900 border-t-brand-600"
            role="status"
            aria-label="Cargando POS..."
          />
          <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">
            Iniciando Kiosko
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden transition-colors duration-200">
      {/* ── Barra superior del kiosko ── */}
      <header className="relative shrink-0 h-13 flex items-center justify-between px-4 bg-white dark:bg-[#111111] border-b border-neutral-200 dark:border-white/5 transition-colors duration-200">
        {/* Línea decorativa brand */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-linear-to-r from-brand-700 via-brand-500 to-brand-700 opacity-60" />

        {/* Logo + título */}
        <Link href="/pos" className="flex items-center gap-3" aria-label="POS Inicio">
          <Image
            src="/logo-pauleam.png"
            alt="Logo PAuleam"
            width={28}
            height={28}
            style={{ width: 28, height: 28 }}
            className="object-contain dark:invert"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white">
              PAuleam
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">
              Punto de Venta
            </span>
          </div>
        </Link>

        {/* Estado kiosko */}
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-accent-600 dark:text-accent-500" aria-hidden="true" />
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-widest text-accent-600 dark:text-accent-500">
            Kiosko Activo
          </span>
        </div>

        {/* Operador + theme toggle + logout */}
        <div className="flex items-center gap-3">
          {role === "admin" && (
            <Link
              href="/admin/dashboard"
              title="Volver al panel de administración"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold
                text-neutral-600 dark:text-neutral-400
                hover:bg-neutral-100 dark:hover:bg-white/10
                hover:text-neutral-900 dark:hover:text-white
                transition-all duration-150 active:scale-95"
            >
              <LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}
          <ThemeToggle />
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-32">
              {user?.profile?.name ?? user?.email ?? "Operador"}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {role === "sales_kiosk" ? "Cajero" : "Admin"}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex h-8 w-8 items-center justify-center rounded-md
              text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white
              transition-all duration-150 active:scale-95"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Contenido POS ── */}
      <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
