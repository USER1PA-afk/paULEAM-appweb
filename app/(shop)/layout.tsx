"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useCart } from "@features/checkout/hooks";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useState } from "react";
import { ShoppingCart, Menu, X, User, LayoutDashboard } from "lucide-react";
import { Footer } from "@shared/components/footer";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const { role } = useRole();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Shop Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo-pauleam.png"
              alt="Logo PAuleam"
              width={32}
              height={32}
              style={{ width: 32, height: 32 }}
              className="shrink-0 object-contain dark:invert"
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              PAuleam
            </span>
          </Link>

          {/* ── Desktop nav (≥ sm) ── */}
          <nav aria-label="Tienda" className="hidden sm:flex items-center gap-6">
            <Link
              href="/shop/catalog"
              aria-current={pathname === "/shop/catalog" ? "page" : undefined}
              className={`text-sm font-medium transition-colors ${
                pathname === "/shop/catalog"
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Catálogo
            </Link>

            {isAuthenticated && (
              <Link
                href="/shop/orders"
                aria-current={pathname === "/shop/orders" ? "page" : undefined}
                className={`text-sm font-medium transition-colors ${
                  pathname === "/shop/orders"
                    ? "text-brand-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mis Pedidos
              </Link>
            )}

            <Link
              href="/shop/cart"
              aria-current={pathname === "/shop/cart" ? "page" : undefined}
              className={`relative text-sm font-medium transition-colors ${
                pathname === "/shop/cart"
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                Carrito
              </span>
              {itemCount > 0 && (
                <span
                  aria-label={`${itemCount} artículos en el carrito`}
                  className="absolute -top-2 -right-4 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white"
                >
                  {itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-32">
                    {user?.profile?.name?.split(" ")[0] ?? user?.email}
                  </span>
                </div>
                {(role === "admin" || role === "operario") && (
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
                    <span className="hidden xl:inline">Dashboard</span>
                  </Link>
                )}
                <button
                  onClick={() => signOut()}
                  className="rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                Ingresar
              </Link>
            )}

            <div className="pl-2 border-l border-border">
              <ThemeToggle />
            </div>
          </nav>

          {/* ── Mobile right: cart icon + hamburger (< sm) ── */}
          <div className="flex items-center gap-2 sm:hidden">
            <Link
              href="/shop/cart"
              aria-label={`Carrito${itemCount > 0 ? `, ${itemCount} artículos` : ""}`}
              className={`relative p-1.5 rounded-md transition-colors ${
                pathname === "/shop/cart"
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ShoppingCart aria-hidden="true" className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        {menuOpen && (
          <div className="sm:hidden border-t border-border bg-background/98 backdrop-blur-sm px-4 py-3 space-y-1 shadow-md">
            <Link
              href="/shop/catalog"
              onClick={close}
              className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/shop/catalog"
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Catálogo
            </Link>

            {isAuthenticated && (
              <Link
                href="/shop/orders"
                onClick={close}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/shop/orders"
                    ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                Mis Pedidos
              </Link>
            )}

            <Link
              href="/shop/cart"
              onClick={close}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/shop/cart"
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Carrito
              {itemCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Auth section */}
            <div className="pt-2 mt-1 border-t border-border space-y-1">
              {isAuthenticated ? (
                <>
                  {(user?.profile?.name ?? user?.email) && (
                    <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                      <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {user?.profile?.name?.split(" ")[0] ?? user?.email}
                      </span>
                    </div>
                  )}
                  {(role === "admin" || role === "operario") && (
                    <Link
                      href="/admin/dashboard"
                      onClick={close}
                      title="Volver al panel de administración"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium
                        text-neutral-600 dark:text-neutral-400
                        hover:bg-neutral-100 dark:hover:bg-white/10
                        hover:text-neutral-900 dark:hover:text-white
                        transition-all duration-150"
                    >
                      <LayoutDashboard aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Dashboard
                    </Link>
                  )}
                  <button
                    onClick={() => { close(); signOut(); }}
                    className="w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={close}
                  className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Ingresar
                </Link>
              )}
            </div>

            {/* Theme toggle */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border mt-1">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main id="main-content" className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
