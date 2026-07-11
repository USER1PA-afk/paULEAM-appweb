"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <span className="text-2xl" aria-hidden="true">⚠</span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Algo salió mal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.digest ? `Ref: ${error.digest}` : "Se produjo un error en el panel administrativo."}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
