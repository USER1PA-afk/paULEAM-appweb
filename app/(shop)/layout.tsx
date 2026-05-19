"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, useRole } from "@features/auth/hooks";
import { useCart } from "@features/checkout/hooks";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
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
            <Image
              src="/logo-pauleam.png"
              alt="Logo PAuleam"
              width={32}
              height={32}
              className="shrink-0 object-contain dark:invert"
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              PAuleam
            </span>
          </Link>

          <nav aria-label="Tienda" className="flex items-center gap-4 sm:gap-6">
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
                className={`hidden sm:block text-sm font-medium transition-colors ${
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
                <span aria-label={`${itemCount} artículos en el carrito`} className="absolute -top-2 -right-4 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {user?.email}
                </span>
                {(role === "admin" || role === "operario") && (
                  <Link
                    href="/admin/dashboard"
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                  >
                    Panel Admin
                  </Link>
                )}
                <button
                  onClick={signOut}
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
            
            <div className="pl-2 border-l border-border hidden sm:block">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main id="main-content" className="flex-1">{children}</main>

      <Footer />

    </div>
  );
}
