import type { Metadata } from "next";
import { PosShell } from "./pos-shell";

/**
 * El POS es interno (solo cajeros y admins autenticados). No debe aparecer
 * en Google.
 */
export const metadata: Metadata = {
  title: "Punto de Venta — PAuleam",
  robots: { index: false, follow: false, nocache: true },
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <PosShell>{children}</PosShell>;
}
