import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop/catalog", "/shop/product/"],
        disallow: [
          "/admin/",
          "/api/",
          "/pos",
          "/pos/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/complete-register",
          "/logout",
          "/auth/",
          "/offline",
          "/shop/cart",
          "/shop/orders",
          "/shop/reservations",
          "/shop/checkout",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
