import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { HomeAuthNav } from "@features/auth/components/home-auth-nav";
import { HomeMobileNav } from "@features/auth/components/home-mobile-nav";
import { Footer } from "@shared/components/footer";
import { ProductCarousel } from "@features/store-products/components/product-carousel";
import { LandingHeaderLogo } from "@shared/components/landing-header-logo";
import { JsonLd } from "@shared/components/json-ld";
import { Leaf, Award, Truck } from "lucide-react";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PAuleam — Planta de Alimentos ULEAM",
  alternateName: ["PAuleam", "Planta de Alimentos ULEAM", "Panchitos ULEAM"],
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  description:
    "Productos alimenticios artesanales elaborados en la Planta de Alimentos de la Universidad Laica Eloy Alfaro de Manabí (ULEAM), Chone, Ecuador.",
  parentOrganization: {
    "@type": "CollegeOrUniversity",
    name: "Universidad Laica Eloy Alfaro de Manabí",
    alternateName: "ULEAM",
    url: "https://www.uleam.edu.ec",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "EC",
    addressRegion: "Manabí",
    addressLocality: "Chone",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["es"],
  },
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PAuleam",
  url: SITE_URL,
  inLanguage: "es-EC",
  publisher: {
    "@type": "Organization",
    name: "Planta de Alimentos ULEAM",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/shop/catalog?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

// ─── Value props ──────────────────────────────────────────────────────────────

const VALUES = [
  {
    Icon: Leaf,
    title: "100% Natural",
    desc: "Elaborado con materias primas seleccionadas, sin conservantes artificiales.",
    iconBg: "bg-accent-50 dark:bg-accent-900/30",
    iconColor: "text-accent-600 dark:text-accent-400",
  },
  {
    Icon: Award,
    title: "Calidad ULEAM",
    desc: "Producción supervisada bajo estándares académicos y de inocuidad alimentaria.",
    iconBg: "bg-brand-50 dark:bg-brand-900/30",
    iconColor: "text-brand-600 dark:text-brand-400",
  },
  {
    Icon: Truck,
    title: "Entrega directa",
    desc: "Directo de nuestra planta a tu puerta, fresco y con trazabilidad completa.",
    iconBg: "bg-accent-50 dark:bg-accent-900/30",
    iconColor: "text-accent-600 dark:text-accent-400",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={ORG_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-pauleam.png"
              alt="Logo PAuleam"
              width={40}
              height={40}
              style={{ width: 40, height: 40 }}
              className="shrink-0 object-contain dark:invert"
            />
            <span className="text-sm font-extrabold tracking-tight text-foreground uppercase">
              PAuleam
            </span>
            <LandingHeaderLogo />
          </Link>

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

          <HomeMobileNav />
        </div>
      </header>

      {/* ── Brand accent stripe ── */}
      <div className="h-1 w-full bg-linear-to-r from-brand-600 via-brand-500 to-accent-500" />

      <main id="main-content" className="flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Subtle dot grid */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-brand-500) 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />
          {/* Warm radial glow */}
          <div
            aria-hidden="true"
            className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-brand-100/40 dark:bg-brand-900/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-accent-100/40 dark:bg-accent-900/10 blur-3xl"
          />

          <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-4">
              <div className="lg:hidden mb-6">
                <Image
                  data-hero-panchito
                  src="/PANCHITOS_logo_page-0001.png"
                  alt="Logo Panchitos"
                  width={300}
                  height={300}
                  className="mx-auto object-contain"
                  priority
                />
              </div>

              <div className="max-w-2xl space-y-6">

                <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Sabores que nacen{" "}
                  <span className="relative whitespace-nowrap">
                    <span className="bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                      de la tierra
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-linear-to-r from-brand-500 to-accent-500"
                    />
                  </span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Productos alimenticios artesanales elaborados en la Planta de
                  Alimentos de la{" "}
                  <span className="font-semibold text-foreground">ULEAM</span>.
                  Calidad académica, sabor auténtico, directo a tu mesa.
                </p>

                {/* Metrics */}
                <div className="flex flex-wrap gap-8 pt-2">
                  {[
                    { value: "100%", label: "Natural", color: "text-accent-600 dark:text-accent-400" },
                    { value: "S/A",  label: "Conservantes", color: "text-brand-600 dark:text-brand-400" },
                    { value: "Local", label: "Producción", color: "text-uleam-gray dark:text-muted-foreground" },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden lg:flex lg:flex-1 lg:justify-end">
                <Image
                  data-hero-panchito
                  src="/PANCHITOS_logo_page-0001.png"
                  alt="Logo Panchitos"
                  width={640}
                  height={640}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Product Carousel ── */}
        <section className="relative overflow-hidden">
          {/* Decorative glow */}
          <div
            aria-hidden="true"
            className="absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full bg-accent-100/30 dark:bg-accent-900/8 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-16 -right-16 h-[350px] w-[350px] rounded-full bg-brand-100/30 dark:bg-brand-900/8 blur-3xl"
          />

          <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-1">
                  Nuestros productos
                </p>
                <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                  Lo más vendido
                </h2>
              </div>
              <Link
                href="/shop/catalog"
                className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline underline-offset-4 transition-colors"
              >
                Ver todo →
              </Link>
            </div>

            <ProductCarousel />
          </div>
        </section>

        {/* ── Value props ── */}
        <section className="relative overflow-hidden">
          {/* Decorative glow */}
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 h-[350px] w-[350px] rounded-full bg-accent-100/25 dark:bg-accent-900/8 blur-3xl"
          />
          <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16 w-full">
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:shadow-md transition-shadow duration-200"
              >
                <div className={`inline-flex rounded-xl p-3 ${v.iconBg}`}>
                  <v.Icon aria-hidden="true" className={`h-5 w-5 ${v.iconColor}`} />
                </div>
                <h3 className="font-bold text-foreground">{v.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
