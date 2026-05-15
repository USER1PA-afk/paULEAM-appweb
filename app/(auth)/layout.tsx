import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">

      {/* ── Panel izquierdo — Identidad ULEAM ── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col bg-brand-600">

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* Green diagonal accent */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 self-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <span className="text-base font-extrabold text-white">U</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-extrabold text-white uppercase tracking-tight">
                PAuleam
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/60">
                Planta de Alimentos
              </span>
            </div>
          </Link>

          {/* Main copy — centered vertically */}
          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">
                  Sistema ERP v2
                </span>
              </div>

              <h2 className="text-4xl font-extrabold leading-tight text-white">
                Gestión Integral
                <br />
                <span className="text-accent-300">de tu Planta</span>
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/70">
                Inventario, producción, recetas y ventas en un solo lugar.
                Control total de tu operación alimentaria con trazabilidad
                completa.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-8">
              {[
                { value: "100%", label: "Trazable"   },
                { value: "24/7", label: "Disponible" },
                { value: "∞",    label: "Escalable"  },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-extrabold text-white">{s.value}</div>
                  <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {["Inventario", "Producción", "Recetas", "E-Commerce"].map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-white/40">
            © {new Date().getFullYear()} Universidad Laica Eloy Alfaro de Manabí
          </p>
        </div>
      </div>

      {/* ── Panel derecho — Formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">

        {/* Mobile header */}
        <div className="w-full max-w-sm mb-6 lg:hidden space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Regresar al inicio
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-md">
              <span className="text-xs font-extrabold text-white">U</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold uppercase tracking-tight text-foreground">PAuleam</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Planta de Alimentos</span>
            </div>
          </div>
        </div>

        {/* Form slot */}
        <div className="w-full max-w-sm space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
