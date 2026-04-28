import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo — Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-600 to-brand-800">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg font-bold text-white backdrop-blur-sm">
              P
            </div>
            <span className="text-xl font-bold text-white">PAuleam</span>
          </Link>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight text-white">
              Gestión Integral
              <br />
              <span className="text-brand-200">de tu Planta</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-brand-100/80">
              Inventario, producción, recetas y ventas en un solo lugar.
              Control total de tu operación alimentaria con trazabilidad
              completa.
            </p>
            <div className="flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="text-xs text-brand-200">Trazable</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="text-xs text-brand-200">Disponible</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">∞</div>
                <div className="text-xs text-brand-200">Escalable</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-brand-200/60">
            © {new Date().getFullYear()} Planta de Alimentos Uleam - ERP
          </p>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md">
              P
            </div>
            <span className="text-lg font-bold text-foreground">PAuleam</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
