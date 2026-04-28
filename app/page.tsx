import Link from "next/link";
import { ThemeToggle } from "@shared/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
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
          <nav className="hidden items-center gap-6 sm:flex">
            <Link
              href="/shop/catalog"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Tienda
            </Link>
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
            <div className="pl-2 border-l border-border">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-brand-50 via-background to-blue-50 opacity-50" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 lg:py-12">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                🌿 Planta de Alimentos Uleam - ERP Alimentario
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Gestión total de tu{" "}
                <span className="bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                  planta de alimentos
                </span>
              </h1>

              <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Controla inventario, producción, recetas y ventas desde un solo
                lugar. Trazabilidad completa con ledger inmutable y automatización
                inteligente.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/shop/catalog"
                  className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 hover:shadow-lg transition-all"
                >
                  Ver Catálogo →
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-all"
                >
                  Panel Admin
                </Link>
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: "📦",
                  title: "Inventario",
                  desc: "Ledger de doble entrada inmutable. Sin UPDATE, solo INSERT.",
                },
                {
                  icon: "⚙️",
                  title: "Producción",
                  desc: "Motor de escalado automático con triggers PL/pgSQL.",
                },
                {
                  icon: "📋",
                  title: "Recetas",
                  desc: "Fórmulas maestras con cálculo de ingredientes proporcional.",
                },
                {
                  icon: "🛒",
                  title: "E-Commerce",
                  desc: "Tienda integrada con reservas de stock concurrentes.",
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <span className="text-2xl">{feat.icon}</span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {feat.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Planta de Alimentos Uleam - ERP
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Admin
            </Link>
            <Link href="/shop/catalog" className="hover:text-foreground transition-colors">
              Tienda
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
