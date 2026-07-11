import type { MetadataRoute } from "next";
import { createServerClient } from "@shared/lib/insforge/client";
import { productSlug } from "@shared/lib/slug";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

interface ProductRow {
  id: string;
  name: string;
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  updated_at: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── Static pages ───────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/shop/catalog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // ── Dynamic product pages ──────────────────────────────────────────────
  let productPages: MetadataRoute.Sitemap = [];

  try {
    const db = createServerClient();

    const { data: products } = await db.database
      .from("products")
      .select("id, name, is_active, updated_at, created_at")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0);

    if (Array.isArray(products)) {
      productPages = (products as ProductRow[]).map((p) => ({
        url: `${SITE_URL}/shop/product/${productSlug(p.name, p.id)}`,
        lastModified: new Date(p.updated_at ?? p.created_at ?? now),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }

    // Categories (public read per RLS) — index for breadth.
    const { data: categories } = await db.database
      .from("categories")
      .select("id, name, updated_at")
      .order("name");

    if (Array.isArray(categories)) {
      const categoryPages: MetadataRoute.Sitemap = (
        categories as CategoryRow[]
      ).map((c) => ({
        url: `${SITE_URL}/shop/catalog?category=${encodeURIComponent(c.id)}`,
        lastModified: new Date(c.updated_at ?? now),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
      // Categories are query-string filters, not unique URLs — keep them but
      // do not duplicate the canonical catalog entry.
      productPages = [...categoryPages, ...productPages];
    }
  } catch {
    // Sitemap must never throw at runtime — fall back to static pages.
  }

  return [...staticPages, ...productPages];
}
