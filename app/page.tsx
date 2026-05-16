import Link from "next/link";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { HomeAuthNav } from "@features/auth/components/home-auth-nav";
import { Package, Factory, ClipboardList, ShoppingCart } from "lucide-react";
import { Footer } from "@shared/components/footer";


const FEATURES = [
  {
    title: "Inventario",
    desc: "Ledger de doble entrada inmutable. Sin UPDATE, solo INSERT.",
    Icon: Package,
    color: "border-brand-200 dark:border-brand-800",
    badge: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    iconColor: "text-brand-600 dark:text-brand-400",
  },
  {
    title: "Producción",
    desc: "Motor de escalado automático con triggers PL/pgSQL.",
    Icon: Factory,
    color: "border-accent-200 dark:border-accent-800",
    badge: "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300",
    iconColor: "text-accent-600 dark:text-accent-400",
  },
  {
    title: "Recetas",
    desc: "Fórmulas maestras con cálculo de ingredientes proporcional.",
    Icon: ClipboardList,
    color: "border-brand-200 dark:border-brand-800",
    badge: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    iconColor: "text-brand-600 dark:text-brand-400",
  },
  {
    title: "E-Commerce",
    desc: "Tienda integrada con reservas de stock concurrentes.",
    Icon: ShoppingCart,
    color: "border-accent-200 dark:border-accent-800",
    badge: "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300",
    iconColor: "text-accent-600 dark:text-accent-400",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-md">
              <span className="text-sm font-extrabold text-white tracking-tight">U</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold tracking-tight text-foreground uppercase">
                PAuleam
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Planta de Alimentos
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav aria-label="Principal" className="hidden items-center gap-6 sm:flex">
            <Link
              href="/shop/catalog"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Tienda
            </Link>
            <HomeAuthNav />
            <div className="pl-2 border-l border-border">
              <ThemeToggle />
            </div>
          </nav>

          {/* Mobile: solo toggle */}
          <div className="flex sm:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── ULEAM accent stripe ── */}
      <div className="h-1 w-full bg-linear-to-r from-brand-600 via-brand-500 to-accent-500" />

      {/* ── Hero ── */}
      <main id="main-content" className="relative flex flex-1 items-center overflow-hidden">
        {/* Background */}
        <div aria-hidden="true" className="absolute inset-0 bg-white dark:bg-background" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-brand-500) 1px, transparent 0)`,
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 lg:py-16">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">

            {/* Copy */}
            <div className="space-y-7">
              {/* Institution badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 dark:border-brand-800 dark:bg-brand-900/20">
                <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" aria-hidden="true" />
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                  ULEAM · Planta de Alimentos · ERP
                </span>
              </div>

              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Gestión total de tu{" "}
                <span className="relative">
                  <span className="bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                    planta
                  </span>
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-linear-to-r from-brand-500 to-accent-500 rounded-full" />
                </span>{" "}
                de{" "}
                <span className="bg-linear-to-r from-accent-600 to-accent-400 bg-clip-text text-transparent">
                  alimentos
                </span>
              </h1>

              <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Controla inventario, producción, recetas y ventas desde un solo
                lugar. Trazabilidad completa con ledger inmutable y
                automatización inteligente.
              </p>

              {/* Stats row */}
              <div className="flex gap-6 pt-1">
                {[
                  { value: "100%", label: "Trazable", color: "text-brand-600 dark:text-brand-400" },
                  { value: "24/7",  label: "Disponible", color: "text-accent-600 dark:text-accent-400" },
                  { value: "∞",     label: "Escalable", color: "text-uleam-gray dark:text-muted-foreground" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/shop/catalog"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 hover:shadow-lg active:scale-[.98] transition-all duration-150"
                >
                  Ver Catálogo
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all duration-150"
                >
                  Panel Admin
                </Link>
              </div>
            </div>

            {/* Feature grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className={`group rounded-2xl border-2 ${feat.color} bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <feat.Icon aria-hidden="true" className={`h-6 w-6 ${feat.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{feat.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />

    </div>
  );
}
