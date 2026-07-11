import type { Metadata } from "next";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Sin conexión — PAuleam",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-black text-brand-600">⚡</p>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sin conexión</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          No pudimos cargar esta página. Revisá tu conexión a internet e intentá de nuevo.
        </p>
      </div>
      <RetryButton />
    </div>
  );
}
