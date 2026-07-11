import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "@shared/components/json-ld";
import { getProductBySlug, getProductImages } from "@features/store-products/lib/get-product";
import { ProductDetailView } from "@features/store-products/components";
import { createServerClient } from "@shared/lib/insforge/client";
import { productSlug } from "@shared/lib/slug";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

interface StockRow {
  stock_available: number | string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── generateStaticParams ────────────────────────────────────────────────────
// Pre-renders the most recently updated active finished products so Vercel
// caches their HTML and Google can index them on first crawl. The full set
// is still reachable via on-demand render + ISR.

export const revalidate = 3600; // 1h

export async function generateStaticParams() {
  try {
    const db = createServerClient();
    const { data } = await db.database
      .from("products")
      .select("id, name, updated_at")
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!Array.isArray(data)) return [];
    return (data as { id: string; name: string }[]).map((p) => ({
      slug: productSlug(p.name, p.id),
    }));
  } catch {
    return [];
  }
}

// ─── generateMetadata ────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return { title: "Producto no encontrado" };
  }

  const name = String(product.name);
  const description =
    (product.short_description as string | null) ||
    (product.description as string | null) ||
    `${name} elaborado en la Planta de Alimentos ULEAM. Calidad artesanal con trazabilidad completa.`;
  const imageUrl = (product.image_url as string | null) ?? null;
  const canonical = `${SITE_URL}/shop/product/${slug}`;

  return {
    title: `${name} — Planta de Alimentos ULEAM`,
    description: description.slice(0, 160),
    keywords: [
      name,
      `${name} ULEAM`,
      "Planta de Alimentos ULEAM",
      "PAuleam",
      "productos artesanales Ecuador",
    ],
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${name} — PAuleam`,
      description: description.slice(0, 200),
      siteName: "PAuleam — Planta de Alimentos ULEAM",
      locale: "es_EC",
      images: imageUrl
        ? [{ url: imageUrl, alt: name, width: 1200, height: 1200 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — PAuleam`,
      description: description.slice(0, 200),
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [images, stockRow] = await Promise.all([
    getProductImages(product.id),
    (async () => {
      try {
        const db = createServerClient();
        const { data } = await db.database
          .from("stock_summary")
          .select("stock_available")
          .eq("product_id", product.id)
          .maybeSingle();
        const r = data as StockRow | null;
        return Number(r?.stock_available ?? 0);
      } catch {
        return 0;
      }
    })(),
  ]);

  const name = String(product.name);
  const description =
    (product.long_description as string | null) ||
    (product.description as string | null) ||
    (product.short_description as string | null) ||
    "";
  const imageUrl = (product.image_url as string | null) ?? undefined;
  const canonical = `${SITE_URL}/shop/product/${slug}`;

  // ── JSON-LD: Product ──
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: imageUrl ? [imageUrl] : undefined,
    description,
    sku: String(product.sku ?? ""),
    brand: { "@type": "Brand", name: "Planta de Alimentos ULEAM" },
    manufacturer: {
      "@type": "Organization",
      name: "Universidad Laica Eloy Alfaro de Manabí — Planta de Alimentos",
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "USD",
      price: Number(product.price).toFixed(2),
      availability:
        stockRow > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Planta de Alimentos ULEAM" },
    },
  };

  // ── JSON-LD: BreadcrumbList ──
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tienda", item: `${SITE_URL}/shop/catalog` },
      { "@type": "ListItem", position: 3, name, item: canonical },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* ── Breadcrumb nav (visible + accessible) ── */}
      <nav
        aria-label="Migas de pan"
        className="border-b border-border bg-card/40"
      >
        <ol className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 text-xs text-muted-foreground sm:px-6 sm:text-sm">
          <li>
            <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
              <Home aria-hidden="true" className="h-3.5 w-3.5" />
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li>
            <Link href="/shop/catalog" className="hover:text-foreground transition-colors">
              Tienda
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="truncate font-medium text-foreground" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <ProductDetailView
            product={{
              id: String(product.id),
              name,
              sku: String(product.sku ?? ""),
              price: Number(product.price),
              unit: String(product.unit ?? "und"),
              capacity_unit: (product.capacity_unit as string | null) ?? null,
              sales_unit_name: (product.sales_unit_name as string | null) ?? null,
              conversion_factor: Number(product.conversion_factor ?? 1),
              image_url: (product.image_url as string | null) ?? null,
              short_description: (product.short_description as string | null) ?? null,
              description: (product.description as string | null) ?? null,
              long_description: (product.long_description as string | null) ?? null,
              ingredients: (product.ingredients as string | null) ?? null,
              nutritional_info: (product.nutritional_info as Record<string, string> | null) ?? null,
              specifications: (product.specifications as Record<string, string> | null) ?? null,
              commercial_details: (product.commercial_details as string | null) ?? null,
              featured: Boolean(product.featured),
              weight: (product.weight as number | null) ?? null,
            }}
            images={images.map((img) => ({
              id: String(img.id),
              public_url: String(img.public_url),
              alt_text: (img.alt_text as string | null) ?? null,
              is_primary: Boolean(img.is_primary),
            }))}
            stockAvailable={stockRow}
          />
        </div>
      </main>
    </div>
  );
}
