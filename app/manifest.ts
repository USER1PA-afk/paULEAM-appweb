import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest (Next.js native metadata route).
// theme_color matches --color-brand-600 (#cc0000) from globals.css.
//
// Shortcuts (POS + Tienda) provide quick-launch icons in the OS app
// launcher on Android. start_url points to the public catalog so an
// unauthenticated user lands on the storefront, not the login screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAuleam — ERP & E-Commerce | Planta de Alimentos ULEAM",
    short_name: "PAuleam",
    description:
      "Sistema integrado de gestión industrial y comercio electrónico para la planta de alimentos de la ULEAM Chone.",
    start_url: "/shop/catalog",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#cc0000",
    lang: "es-EC",
    categories: ["business", "shopping", "food"],
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
    shortcuts: [
      {
        name: "Punto de Venta",
        short_name: "POS",
        url: "/pos",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Catálogo",
        short_name: "Tienda",
        url: "/shop/catalog",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
