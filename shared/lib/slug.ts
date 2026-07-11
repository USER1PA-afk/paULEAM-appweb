/**
 * URL-safe product slug used by the SEO-friendly product pages and the
 * sitemap. The trailing 8-char id segment lets the detail page resolve
 * the product even if two products share a name.
 */
export function productSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const shortId = id.replace(/-/g, "").slice(0, 8);
  return `${base || "producto"}-${shortId}`;
}
