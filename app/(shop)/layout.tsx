"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useCart } from "@features/checkout/hooks";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useEffect } from "react";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const { role } = useRole();
  const { itemCount } = useCart();

  // Escribir el rol en cookie para que el proxy pueda hacer redirects correctos
  useEffect(() => {
    if (role) {
      document.cookie = `pauleam-role=${role}; path=/; max-age=3600; SameSite=Lax`;
    }
  }, [role]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Shop Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md">
              P
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              PAuleam
            </span>
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/shop/catalog"
              className={`text-sm font-medium transition-colors ${
                pathname === "/shop/catalog"
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Catálogo
            </Link>

            <Link
              href="/shop/cart"
              className={`relative text-sm font-medium transition-colors ${
                pathname === "/shop/cart"
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🛒 Carrito
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-4 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {user?.email}
                </span>
                <button
                  onClick={signOut}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Salir
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
            
            <div className="pl-2 border-l border-border hidden sm:block">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Finca Tigrillo
          </p>
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Panel Admin →
          </Link>
        </div>
      </footer>
    </div>
  );
}
