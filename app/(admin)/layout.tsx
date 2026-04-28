"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@shared/components/theme-toggle";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: "📊",
    roles: ["admin", "operario"],
  },
  {
    label: "Inventario",
    href: "/admin/inventory",
    icon: "📦",
    roles: ["admin", "operario"],
  },
  {
    label: "Producción",
    href: "/admin/production",
    icon: "⚙️",
    roles: ["admin", "operario"],
  },
  {
    label: "Recetas",
    href: "/admin/recipes",
    icon: "📋",
    roles: ["admin"],
  },
  {
    label: "Productos",
    href: "/admin/products",
    icon: "🏷️",
    roles: ["admin", "operario"],
  },
  {
    label: "Órdenes de Venta",
    href: "/admin/orders",
    icon: "🛒",
    roles: ["admin"],
  },
  {
    label: "Usuarios",
    href: "/admin/users",
    icon: "👥",
    roles: ["admin"],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-brand-600 text-white" },
  operario: { label: "Operario", color: "bg-blue-600 text-white" },
  cliente: { label: "Cliente", color: "bg-amber-600 text-white" },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const { role, isStaff, loading: roleLoading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guardar el rol en una cookie para que el proxy pueda usarlo
  // en futuras navegaciones server-side sin necesidad de JWT.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!role) return;
    document.cookie = `pauleam-role=${role}; path=/; max-age=3600; SameSite=Lax`;
    // Clientes no deben estar en el panel admin — redirigir inmediatamente
    if (role === "cliente") {
      router.replace("/shop/catalog");
    }
  }, [role, router, authLoading, isAuthenticated]);

  const filteredNav = NAV_ITEMS.filter(
    (item) => role && item.roles.includes(role)
  );

  const roleInfo = role ? ROLE_LABELS[role] : null;

  // Mostrar spinner mientras se determina la sesión/rol (evita flash)
  if (authLoading || (isAuthenticated && roleLoading) || role === "cliente" || (!authLoading && !isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-border bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md">
              P
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-foreground">
                PAuleam
              </span>
              <span className="ml-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                ERP
              </span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Navegación
          </div>
          <ul className="space-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Divider + Tienda */}
          <div className="my-4 border-t border-border" />
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Tienda
          </div>
          <Link
            href="/shop/catalog"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <span className="text-base">🌐</span>
            <span>Ver E-Commerce</span>
          </Link>
        </nav>

        {/* User section */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-sm font-bold text-white shadow-sm">
              {user?.profile?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.profile?.name ?? user?.email ?? "Sin sesión"}
              </p>
              {roleInfo && (
                <span
                  className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.color}`}
                >
                  {roleInfo.label}
                </span>
              )}
            </div>
          </div>
          {isAuthenticated && (
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-6 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex-1" />
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Quick info */}
            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              {isStaff && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700 font-medium dark:bg-brand-900/30 dark:text-brand-300">
                  Panel {role === "admin" ? "Administrador" : "Operario"}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
