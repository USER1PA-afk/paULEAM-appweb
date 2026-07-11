"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth, useRole } from "@features/auth/hooks";
import { useCart } from "@features/checkout/hooks";
import { useNotifications } from "@features/notifications/hooks";
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
  Handshake,
  LogOut,
  ShoppingBag,
  Monitor,
  PackageOpen,
  Bell,
  Shield,
  Settings,
  ChevronDown,
  BadgePercent,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Inicio",      href: "/admin/dashboard",  icon: LayoutDashboard, roles: ["admin", "operario"] },
  { label: "Productos",   href: "/admin/products",    icon: Tag,             roles: ["admin", "operario"] },
  { label: "Proveedores", href: "/admin/suppliers",   icon: Handshake,       roles: ["admin"] },
  { label: "Recetas",     href: "/admin/recipes",     icon: ClipboardList,   roles: ["admin"] },
  { label: "Inventario",  href: "/admin/inventory",   icon: Boxes,           roles: ["admin", "operario"] },
  { label: "Producción",  href: "/admin/production",  icon: Factory,         roles: ["admin", "operario"] },
  { label: "Producción bajo demanda", href: "/admin/production-requests", icon: Factory, roles: ["admin", "operario"] },
  { label: "Empaque",     href: "/admin/packaging",   icon: PackageOpen,     roles: ["admin", "operario"] },
  { label: "Usuarios",    href: "/admin/users",       icon: Users,           roles: ["admin"] },
  { label: "Auditoría",  href: "/admin/audit",       icon: Shield,          roles: ["admin"] },
  { label: "Pagos",      href: "/admin/settings",    icon: Settings,        roles: ["admin"] },
];

const SUB_ITEMS = [
  { label: "Punto de Venta",   href: "/pos",          icon: Monitor,      roles: ["admin", "sales_kiosk"] },
  { label: "Órdenes de Venta", href: "/admin/orders", icon: ShoppingCart, roles: ["admin"] },
];

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:       { label: "Administrador", cls: "bg-brand-600 text-white" },
  operario:    { label: "Operario",      cls: "bg-accent-600 text-white" },
  cliente:     { label: "Cliente",       cls: "bg-amber-500 text-white" },
  sales_kiosk: { label: "Cajero POS",    cls: "bg-blue-600 text-white" },
};

/* ── Animated menu icon ──────────────────────────────────────────
   Closed → 3 stacked dots (circles) in brand colors:
            gray #4B4B4B · red #D90404 · green #1FA34A
   Open   → 3 horizontal hamburger lines, same color order
   Transitions: CSS transition-all on width / height / border-radius / position
─────────────────────────────────────────────────────────────────*/
function MenuIcon({ isOpen }: { isOpen: boolean }) {
  const base = "absolute block transition-all duration-300 ease-in-out";
  /*
    Centers aligned in both states (container 20 × 24 px):
      Element 1: center (x=10, y=3)   → dot top=0  left=7 | line top=2  left=0
      Element 2: center (x=10, y=12)  → dot top=9  left=7 | line top=11 left=0
      Element 3: center (x=10, y=21)  → dot top=18 left=7 | line top=20 left=0
    Each element stretches/shrinks from the same point — no positional jump.
  */
  return (
    <div className="relative" style={{ width: 20, height: 24 }}>
      {/* Top — gray #4B4B4B */}
      <span
        className={base}
        style={
          isOpen
            ? { width: 20, height: 2, top: 2,  left: 0, borderRadius: 2,     backgroundColor: "#4B4B4B" }
            : { width: 6,  height: 6, top: 0,  left: 7, borderRadius: "50%", backgroundColor: "#4B4B4B" }
        }
      />
      {/* Middle — red #D90404 */}
      <span
        className={base}
        style={
          isOpen
            ? { width: 20, height: 2, top: 11, left: 0, borderRadius: 2,     backgroundColor: "#D90404" }
            : { width: 6,  height: 6, top: 9,  left: 7, borderRadius: "50%", backgroundColor: "#D90404" }
        }
      />
      {/* Bottom — green #1FA34A */}
      <span
        className={base}
        style={
          isOpen
            ? { width: 20, height: 2, top: 20, left: 0, borderRadius: 2,     backgroundColor: "#1FA34A" }
            : { width: 6,  height: 6, top: 18, left: 7, borderRadius: "50%", backgroundColor: "#1FA34A" }
        }
      />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [storeOpen,        setStoreOpen]        = useState(() =>
    pathname.startsWith("/admin/store") || pathname === "/shop/catalog"
  );
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const handleHamburgerClick = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setSidebarOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace("/login"); return; }
    if (!role) return;
    if (role === "cliente") router.replace("/shop/catalog");
    if (role === "sales_kiosk") router.replace("/pos");
  }, [role, router, authLoading, isAuthenticated]);

  useEffect(() => {
    if (pathname.startsWith("/admin/store") || pathname === "/shop/catalog") {
      setStoreOpen(true);
    }
  }, [pathname]);
  useSessionGuard(() => signOut(false));
  const filteredNav  = NAV_ITEMS.filter((item) => role && item.roles.includes(role));
  const roleInfo     = role ? ROLE_LABELS[role] : null;

  /*
    Icon open-state:
    - Desktop expanded (!sidebarCollapsed=true)  → hamburger lines (sidebar is open)
    - Desktop collapsed (sidebarCollapsed=true)  → vertical dots  (sidebar is closed)
    - Mobile: sidebarCollapsed never changes (false), so icon follows sidebarOpen
      On mobile the hamburger lines are the universal "menu" symbol — acceptable UX.
  */
  const menuIconOpen = sidebarOpen || !sidebarCollapsed;

  if (
    authLoading ||
    (isAuthenticated && roleLoading) ||
    (!authLoading && !isAuthenticated)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          role="status"
          className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
        >
          <span className="sr-only">Cargando...</span>
        </div>
      </div>
    );
  }

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <li>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          title={item.label}
          onClick={(e) => {
            // Ya estamos en esta ruta — re-navegar dispara un refetch RSC
            // (y el navegador re-pide el manifest), remonta la página y
            // repite todas las consultas a Insforge. No hay nada que cargar.
            if (pathname === item.href) e.preventDefault();
            setSidebarOpen(false);
          }}
          className={`flex items-center gap-3 rounded-lg py-2 px-3 text-sm font-medium min-h-9
            transition-all duration-200 ease-out
            ${sidebarCollapsed ? "lg:justify-center lg:px-0 lg:gap-0" : ""}
            ${
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
        >
          <item.icon
            aria-hidden="true"
            className={`shrink-0 h-4 w-4 transition-colors
              ${isActive ? "text-white" : "text-muted-foreground"}`}
          />
          <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ══════════════════════════════════════════
          Full-width Header
          Left:  hamburger + brand (width tracks sidebar)
          Right: user name / role badge / logout
      ══════════════════════════════════════════ */}
      <header className="shrink-0 z-50 h-12 flex items-center gap-3 px-3 bg-card/95 backdrop-blur-md shadow-sm relative">

        {/* ── Hamburger — posición fija, nunca se mueve ── */}
        <button
          onClick={handleHamburgerClick}
          aria-label="Alternar menú lateral"
          aria-controls="admin-sidebar"
          aria-expanded={menuIconOpen}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
            text-muted-foreground hover:bg-muted hover:text-foreground
            transition-colors duration-200"
        >
          <MenuIcon isOpen={menuIconOpen} />
        </button>

        {/* Separador vertical */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* ── Brand: logo + nombre ── */}
        <Link
          href="/admin/dashboard"
          onClick={(e) => {
            if (pathname === "/admin/dashboard") e.preventDefault();
          }}
          className="flex items-center gap-2 min-w-0"
        >
          <Image
            src="/logo-pauleam.png"
            alt="Logo PAuleam"
            width={34}
            height={34}
            style={{ width: 34, height: 34 }}
            className="shrink-0 object-contain dark:invert"
          />
          <span className="hidden sm:block text-[13px] font-extrabold uppercase tracking-tight text-foreground">
            PAuleam
          </span>
          <Image
            src="/PANCHITOS_logo_page-0001.png"
            alt="Logo Panchitos"
            width={97}
            height={32}
            style={{ width: 97, height: 32 }}
            className="shrink-0 object-contain dark:drop-shadow-[0_0_3px_rgba(255,255,255,0.95)]"
          />
        </Link>

        <div className="flex-1" />

        {/* ── User info + logout ── */}
        <div className="flex items-center gap-2 pr-1">
          <ThemeToggle />

          {/* ── Notifications ── */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Notificaciones"
              title="Notificaciones"
              className="flex h-8 w-8 items-center justify-center rounded-lg
                text-muted-foreground hover:bg-muted hover:text-foreground
                transition-colors duration-200 relative"
            >
              <Bell aria-hidden="true" className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-[1.1rem] h-[1.1rem] items-center justify-center
                  rounded-full bg-brand-600 text-[9px] font-bold text-white leading-none px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                {/* Backdrop para cerrar */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                />
                {/* Panel */}
                <div className="absolute right-0 top-10 z-50 w-80
                  rounded-xl border border-border bg-card shadow-xl
                  overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Header del panel */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-semibold text-foreground">Notificaciones</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        className="rounded-full bg-brand-100 dark:bg-brand-900/40
                          px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300
                          hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors"
                      >
                        Marcar leídas
                      </button>
                    )}
                  </div>
                  {/* Lista */}
                  <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No hay notificaciones
                      </li>
                    ) : (
                      notifications.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.title.includes("producción") ? "/admin/production-requests" : "/admin/notifications"}
                            onClick={() => { markRead(n.id); setNotifOpen(false); }}
                            className={`flex items-start gap-3 px-4 py-3 text-sm
                              transition-colors hover:bg-muted/50 cursor-pointer
                              ${n.is_read ? "opacity-60" : ""}`}
                          >
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full
                              ${n.is_read ? "bg-muted-foreground/30" : "bg-brand-600"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground leading-snug font-medium">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {new Date(n.created_at).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-border">
                    <Link
                      href="/admin/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block w-full text-center text-xs text-brand-600 dark:text-brand-400
                        font-medium hover:underline"
                    >
                      Ver todas las notificaciones
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-foreground max-w-52 overflow-hidden text-ellipsis whitespace-nowrap" title={user?.profile?.name ?? user?.email ?? ""}>
              {user?.profile?.name ?? user?.email ?? "Sin sesión"}
            </span>
            {roleInfo && (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${roleInfo.cls}`}
              >
                {roleInfo.label}
              </span>
            )}
          </div>

          {isAuthenticated && (
            <button
              onClick={() => signOut()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg
                text-muted-foreground hover:bg-brand-50 hover:text-brand-700
                dark:hover:bg-brand-900/20 dark:hover:text-brand-300
                transition-all duration-150"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Línea degradada a todo ancho — reemplaza border-b */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-linear-to-r from-brand-600 via-brand-500 to-accent-500" />
      </header>

      {/* ══════════════════════════════════════════
          Body: sidebar + main
      ══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Mobile backdrop — starts below header (top: 48px = h-12) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            style={{ top: 48 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          id="admin-sidebar"
          aria-label="Menú de navegación"
          className={`
            fixed top-12 left-0 bottom-0 z-50 w-64
            flex flex-col overflow-hidden
            bg-card border-r border-border
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
            lg:static lg:top-auto lg:translate-x-0 lg:shadow-none
            ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}
          `}
        >
          {/* Navigation */}
          <nav
            aria-label="Principal"
            className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3
              transition-all duration-300 ease-in-out
              ${sidebarCollapsed ? "lg:px-2" : "px-2.5"}`}
          >
            {/* Main nav group */}
            <div>
              <p
                className={`mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.12em]
                  text-muted-foreground/55 transition-opacity duration-300
                  ${sidebarCollapsed ? "lg:invisible lg:opacity-0" : ""}`}
              >
                Navegación
              </p>
              <ul className="space-y-0.5">
                {filteredNav.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </ul>
            </div>

            {/* Comercial group */}
            <div>
              <div
                className={`transition-opacity duration-300
                  ${sidebarCollapsed ? "lg:invisible lg:opacity-0" : ""}`}
              >
                <div className="border-t border-border/60 pt-2.5 mb-1">
                  <p className="px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">
                    Comercial
                  </p>
                </div>
              </div>
              <ul className="space-y-0.5">
                {/* Gestionar Tienda — collapsible group (admin only) */}
                {role === "admin" && (() => {
                  const storeActive = pathname.startsWith("/admin/store") || pathname === "/shop/catalog";
                  return (
                    <>
                      <li>
                        <div className={`flex items-center rounded-lg py-2 px-3 text-sm font-medium min-h-9
                          transition-all duration-200 ease-out
                          ${sidebarCollapsed ? "lg:justify-center lg:px-0 lg:gap-0" : ""}
                          ${storeActive ? "bg-brand-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"}`}
                        >
                          <Link
                            href="/admin/store/products"
                            onClick={(e) => {
                              if (pathname === "/admin/store/products") e.preventDefault();
                              setSidebarOpen(false);
                            }}
                            title="Gestionar Tienda"
                            className={`flex items-center gap-3 flex-1 min-w-0
                              ${sidebarCollapsed ? "lg:justify-center lg:gap-0 lg:flex-none" : ""}`}
                          >
                            <ShoppingBag
                              aria-hidden="true"
                              className={`shrink-0 h-4 w-4 ${storeActive ? "text-white" : "text-muted-foreground"}`}
                            />
                            <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                              Gestionar Tienda
                            </span>
                          </Link>
                          {!sidebarCollapsed && (
                            <button
                              onClick={() => setStoreOpen((v) => !v)}
                              aria-label={storeOpen ? "Contraer tienda" : "Expandir tienda"}
                              className="ml-auto pl-2 shrink-0"
                            >
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-3.5 w-3.5 transition-transform duration-200
                                  ${storeOpen ? "rotate-180" : ""}
                                  ${storeActive ? "text-white/80" : "text-muted-foreground"}`}
                              />
                            </button>
                          )}
                        </div>
                      </li>
                      {storeOpen && !sidebarCollapsed && (
                        <li>
                          <Link
                            href="/admin/store/promotions"
                            onClick={(e) => {
                              if (pathname === "/admin/store/promotions") e.preventDefault();
                              setSidebarOpen(false);
                            }}
                            aria-current={pathname.startsWith("/admin/store/promotions") ? "page" : undefined}
                            className={`flex items-center gap-3 rounded-lg py-2 pl-8 pr-3 text-sm font-medium min-h-9
                              transition-all duration-200 ease-out
                              ${pathname.startsWith("/admin/store/promotions")
                                ? "bg-brand-600 text-white shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                              }`}
                          >
                            <BadgePercent
                              aria-hidden="true"
                              className={`shrink-0 h-4 w-4 ${pathname.startsWith("/admin/store/promotions") ? "text-white" : "text-muted-foreground"}`}
                            />
                            Promociones
                          </Link>
                        </li>
                      )}
                      {storeOpen && !sidebarCollapsed && (
                        <li>
                          <Link
                            href="/shop/catalog"
                            onClick={() => setSidebarOpen(false)}
                            aria-current={pathname === "/shop/catalog" ? "page" : undefined}
                            className={`flex items-center gap-3 rounded-lg py-2 pl-8 pr-3 text-sm font-medium min-h-9
                              transition-all duration-200 ease-out
                              ${pathname === "/shop/catalog"
                                ? "bg-brand-600 text-white shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                              }`}
                          >
                            <Store
                              aria-hidden="true"
                              className={`shrink-0 h-4 w-4 ${pathname === "/shop/catalog" ? "text-white" : "text-muted-foreground"}`}
                            />
                            Ver eCommerce
                          </Link>
                        </li>
                      )}
                    </>
                  );
                })()}
                {/* Ver E-Commerce standalone for operario */}
                {role === "operario" && (
                  <NavLink item={{ label: "Ver E-Commerce", href: "/shop/catalog", icon: Store, roles: ["admin", "operario"] }} />
                )}
                {/* Remaining sub items */}
                {SUB_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </ul>
            </div>
          </nav>

        </aside>

        {/* ── Main content ── */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-7">
          {role === "cliente" || role === "sales_kiosk" ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div
                role="status"
                className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
              >
                <span className="sr-only">Redirigiendo...</span>
              </div>
              <p className="text-muted-foreground font-medium text-sm">
                Redirigiendo a tu sección correspondiente...
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
