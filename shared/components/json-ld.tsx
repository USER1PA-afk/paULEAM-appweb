/**
 * Server component that emits a JSON-LD <script> tag for schema.org structured
 * data (Organization, Product, WebSite, etc.).
 *
 * Implementation note: we delegate to `next/script` rather than rendering a
 * raw <script> element directly. React 19 warns about any <script> it finds
 * in a React tree ("Scripts inside React components are never executed…")
 * and the warning also fires on the client during hydration of server
 * components that emit one. `next/script` is the framework's official escape
 * hatch — it routes the script through the App Router's special-case
 * handling and suppresses the warning.
 *
 * The `id` is derived from the schema's `@type` so multiple JsonLd
 * instances on the same page each get a unique DOM id (required by
 * next/script).
 */
import Script from "next/script";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const id = `jsonld-${String(data?.["@type"] ?? "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

  return (
    <Script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
