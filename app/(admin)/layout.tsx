import type { Metadata } from "next";
import { AdminShell } from "./admin-shell";

/**
 * El panel administrativo es interno. No debe aparecer en Google.
 */
export const metadata: Metadata = {
  title: "Panel Administrativo — PAuleam",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
