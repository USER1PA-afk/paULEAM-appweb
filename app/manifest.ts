import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest (Next.js native metadata route).
// theme_color matches --color-brand-600 (#cc0000) from globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAuleam — ERP & E-Commerce",
    short_name: "PAuleam",
    description:
      "Sistema integrado de gestión industrial y comercio electrónico para planta de alimentos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#cc0000",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
