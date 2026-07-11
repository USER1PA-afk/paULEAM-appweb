import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-7xl font-black text-brand-600 tabular-nums">404</p>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Página no encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
