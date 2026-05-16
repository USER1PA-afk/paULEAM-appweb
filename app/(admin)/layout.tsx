"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useSessionGuard } from "@shared/hooks/use-session-guard";

import {
  LayoutDashboard,
  Tag,
  ClipboardList,
  Factory,
  Boxes,
  ShoppingCart,
  Users,
  Store,
  X,
  Menu,
  Handshake,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Inicio",      href: "/admin/dashboard",  icon: LayoutDashboard, roles: ["admin", "operario"] },
  { label: "Productos",   href: "/admin/products",    icon: Tag,             roles: ["admin", "operario"] },
  { label: "Proveedores", href: "/admin/suppliers",   icon: Handshake,       roles: ["admin"] },
  { label: "Recetas",     href: "/admin/recipes",     icon: ClipboardList,   roles: ["admin"] },
  { label: "Inventario",  href: "/admin/inventory",   icon: Boxes,           roles: ["admin", "operario"] },
  { label: "Producción",  href: "/admin/production",  icon: Factory,         roles: ["admin", "operario"] },
  { label: "Usuarios",    href: "/admin/users",       icon: Users,           roles: ["admin"] },
];

const SUB_ITEMS = [
  { label: "Ver E-Commerce",    href: "/shop/catalog",    icon: Store,        roles: ["admin", "operario"] },
  { label: "Órdenes de Venta",  href: "/admin/orders",    icon: ShoppingCart, roles: ["admin"] },
];

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:    { label: "Administrador", cls: "bg-brand-600 text-white" },
  operario: { label: "Operario",      cls: "bg-accent-600 text-white" },
  cliente:  { label: "Cliente",       cls: "bg-amber-500 text-white" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const { role, isStaff, loading: roleLoading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace("/login"); return; }
    if (!role) return;
    document.cookie = `pauleam-role=${role}; path=/; max-age=3600; SameSite=Lax`;
    if (role === "cliente") router.replace("/shop/catalog");
  }, [role, router, authLoading, isAuthenticated]);

  useSessionGuard(signOut);

  const filteredNav = NAV_ITEMS.filter((item) => role && item.roles.includes(role));
  const roleInfo    = role ? ROLE_LABELS[role] : null;

  if (authLoading || (isAuthenticated && roleLoading) || role === "cliente" || (!authLoading && !isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando...</span>
        </div>
      </div>
    );
  }

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const isActive = pathname === item.href;
    return (
      <li>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
            isActive
              ? "bg-brand-600 text-white shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <item.icon aria-hidden="true" className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-muted-foreground"}`} />
          <span className="flex-1">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="admin-sidebar"
        aria-label="Menú de navegación"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col transform border-r border-border bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ULEAM top accent */}
        <div className="h-0.5 w-full bg-linear-to-r from-brand-600 via-brand-500 to-accent-500 shrink-0" />

        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
              <span className="text-xs font-extrabold text-white">U</span>
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-extrabold uppercase tracking-tight text-foreground">
                PAuleam
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                ERP · Planta de Alimentos
              </span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú lateral"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Navegación
            </p>
            <ul className="space-y-0.5">
              {filteredNav.map((item) => <NavLink key={item.href} item={item} />)}
            </ul>
          </div>

          <div>
            <div className="mb-2 border-t border-border pt-4">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Comercial
              </p>
            </div>
            <ul className="space-y-0.5">
              {SUB_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </ul>
          </div>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
              {user?.profile?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.profile?.name ?? user?.email ?? "Sin sesión"}
              </p>
              {roleInfo && (
                <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${roleInfo.cls}`}>
                  {roleInfo.label}
                </span>
              )}
            </div>
          </div>
          {isAuthenticated && (
            <button
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 dark:hover:bg-brand-900/20 dark:hover:text-brand-300 dark:hover:border-brand-800 transition-all"
            >
              <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/90 px-5 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú lateral"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>

          {/* Breadcrumb hint */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-brand-600 dark:text-brand-400">ULEAM</span>
            <span className="opacity-40">/</span>
            <span>
              {NAV_ITEMS.find((i) => i.href === pathname)?.label ??
               SUB_ITEMS.find((i) => i.href === pathname)?.label ??
               "Panel"}
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {isStaff && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-900/20 px-3 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                {role === "admin" ? "Administrador" : "Operario"}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
