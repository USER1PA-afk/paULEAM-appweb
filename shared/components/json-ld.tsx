/**
 * Server component that emits a JSON-LD <script> tag. Pass any schema.org
 * object (Organization, Product, WebSite, etc.) — it is stringified so search
 * engines can parse it.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
