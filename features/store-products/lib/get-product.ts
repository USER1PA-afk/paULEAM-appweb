import { productSlug } from "@shared/lib/slug";
import { createServerClient } from "@shared/lib/insforge/client";

/**
 * Resolves a slug like "queso-manaba-1234abcd" to the matching active product
 * by extracting the trailing 8-char id segment and looking it up in the
 * `products` table. Returns null when no active finished-product matches.
 */
export async function getProductBySlug(slug: string) {
  const m = slug.match(/-([0-9a-f]{8})$/i);
  if (!m) return null;
  const id = m[1];

  const db = createServerClient();
  const { data } = await db.database
    .from("products")
    .select(
      "id, name, sku, type, unit, capacity_unit, price, image_url, short_description, description, long_description, specifications, ingredients, nutritional_info, weight, commercial_details, is_active, featured, conversion_factor, sales_unit_name, category_id, created_at, updated_at"
    )
    .eq("id", id)
    .eq("type", "PRODUCTO_TERMINADO")
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return data as Record<string, unknown> & { id: string; name: string };
}

/**
 * Fetches all gallery images for a product. Uses the server client so the
 * public bucket URL is correct on first render.
 */
export interface ProductGalleryImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  public_url: string;
}

export async function getProductImages(productId: string): Promise<ProductGalleryImage[]> {
  const db = createServerClient();
  const { data } = await db.database
    .from("product_images")
    .select("id, product_id, storage_path, alt_text, position, is_primary, public_url")
    .eq("product_id", productId)
    .order("position");

  return ((data as Record<string, unknown>[]) ?? []).map((row) => {
    const storage_path = String(row.storage_path ?? "");
    // Server-side: generate the public URL the same way the SDK does.
    const public_url = db.storage
      .from("product-images")
      .getPublicUrl(storage_path);
    return {
      id: String(row.id),
      product_id: String(row.product_id ?? productId),
      storage_path,
      alt_text: (row.alt_text as string | null) ?? null,
      position: Number(row.position ?? 0),
      is_primary: Boolean(row.is_primary),
      public_url,
    };
  });
}

export function productUrlFor(name: string, id: string): string {
  return `/shop/product/${productSlug(name, id)}`;
}
