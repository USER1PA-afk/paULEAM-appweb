import { productSlug } from "@shared/lib/slug";
import { createServerClient } from "@shared/lib/insforge/client";

/**
 * Resolves a slug like "queso-manaba-1234abcd" to the matching active product.
 *
 * `productSlug` embeds only the first 8 hex chars of the UUID (its first group),
 * so we cannot look up by the full id. PostgREST has no `LIKE` for the `uuid`
 * type, but uuid comparison operators do exist — so we match every UUID whose
 * first group equals the prefix via an indexed range scan
 * `[prefix-0000-…, prefix-ffff-…]`. Returns null when no active finished-product
 * matches.
 */
export async function getProductBySlug(slug: string) {
  const m = slug.match(/-([0-9a-f]{8})$/i);
  if (!m) return null;
  const prefix = m[1].toLowerCase();

  const db = createServerClient();
  const { data } = await db.database
    .from("products")
    .select(
      "id, name, sku, type, unit, capacity_unit, price, image_url, short_description, description, long_description, specifications, ingredients, nutritional_info, weight, commercial_details, is_active, featured, conversion_factor, sales_unit_name, category_id, created_at, updated_at"
    )
    .gte("id", `${prefix}-0000-0000-0000-000000000000`)
    .lte("id", `${prefix}-ffff-ffff-ffff-ffffffffffff`)
    .eq("type", "PRODUCTO_TERMINADO")
    .eq("is_active", true)
    .limit(1);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return row as Record<string, unknown> & { id: string; name: string };
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
