import type { Metadata } from "next";
import CatalogClient from "./catalog-client";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

export const metadata: Metadata = {
  title: "Catálogo de Productos — Planta de Alimentos ULEAM",
  description:
    "Catálogo de productos artesanales elaborados en la Planta de Alimentos de la ULEAM. Quesos, embutidos y más, con trazabilidad completa y entrega directa.",
  keywords: [
    "catálogo PAuleam",
    "productos ULEAM",
    "Queso Manaba",
    "planta de alimentos Ecuador",
    "comprar queso ULEAM",
  ],
  alternates: { canonical: `${SITE_URL}/shop/catalog` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/shop/catalog`,
    title: "Catálogo de Productos — PAuleam",
    description:
      "Productos artesanales de la Planta de Alimentos ULEAM. Compra en línea con trazabilidad completa.",
    locale: "es_EC",
    siteName: "PAuleam — Planta de Alimentos ULEAM",
    images: ["/logo-pauleam.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catálogo de Productos — PAuleam",
    description:
      "Productos artesanales de la Planta de Alimentos ULEAM. Compra en línea con trazabilidad completa.",
    images: ["/logo-pauleam.png"],
  },
};

export default function CatalogPage() {
  return <CatalogClient />;
}
